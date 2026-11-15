// Singleton de Gestión de Conexión Web Serial Bluetooth para Wall-E

class SerialConnectionManager {
  constructor() {
    this.port = null;
    this.reader = null;
    this.isReading = false;
    this.isConnected = false;
    this.listeners = new Set();
    this.buffer = '';
    this.lastRawLine = '';
    this.stats = { packetsReceived: 0, bytesReceived: 0 };
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(data, raw) {
    this.stats.packetsReceived++;
    this.lastRawLine = raw;
    this.listeners.forEach((cb) => {
      try {
        cb(data, raw);
      } catch (e) {
        console.warn('Error en callback de telemetría:', e);
      }
    });
  }

  isOpen() {
    return this.isConnected && this.port !== null;
  }

  // Parseador ultra-flexible: reconoce JSON, pares Clave-Valor, CSV y texto sin formato
  parseTelemetryLine(line) {
    let result = {
      source: 'HARDWARE_ESP32',
      device: 'Wall-E-ESP32'
    };

    if (!line || typeof line !== 'string') return result;

    // 1. JSON estándar o fragmento {...}
    const jsonMatch = line.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        const temp = obj.temperature ?? obj.temp ?? obj.t ?? obj.temperatura;
        const hum = obj.humidity ?? obj.hum ?? obj.h ?? obj.humedad;
        const dist = obj.distance_cm ?? obj.distance ?? obj.dist ?? obj.cm ?? obj.d ?? obj.distancia;
        const cmd = obj.command ?? obj.cmd ?? obj.marcha;
        const speed = obj.speed ?? obj.vel;
        const batt = obj.battery ?? obj.bat;

        if (temp !== undefined && !isNaN(parseFloat(temp))) {
          result.temperature = Number(parseFloat(temp).toFixed(1));
        }
        if (hum !== undefined && !isNaN(parseFloat(hum))) {
          result.humidity = Number(parseFloat(hum).toFixed(1));
        }
        if (dist !== undefined && !isNaN(parseFloat(dist))) {
          result.distance_cm = Number(parseFloat(dist).toFixed(1));
        }
        if (cmd !== undefined) result.command = String(cmd);
        if (speed !== undefined) result.speed = Number(parseFloat(speed).toFixed(2));
        if (batt !== undefined) result.battery = Number(parseFloat(batt).toFixed(1));

        return result;
      } catch (e) {
        // Continuar a regex si falló el parseo JSON
      }
    }

    // 2. Extracción por Regex (ej: "Temp: 24.5 Hum: 48 Dist: 120" o "T=24.5 D=120 cm")
    const tempMatch = line.match(/(?:temp(?:erature|eratura)?|clima|t)[:= ]*([0-9.]+)/i);
    const humMatch = line.match(/(?:hum(?:idity|edad)?|h)[:= ]*([0-9.]+)/i);
    const distMatch = line.match(/(?:dist(?:ance|ancia)?(?:_cm)?|sonar|cm|eco|d)[:= ]*([0-9.]+)/i);

    if (tempMatch && !isNaN(parseFloat(tempMatch[1]))) {
      result.temperature = Number(parseFloat(tempMatch[1]).toFixed(1));
    }
    if (humMatch && !isNaN(parseFloat(humMatch[1]))) {
      result.humidity = Number(parseFloat(humMatch[1]).toFixed(1));
    }
    if (distMatch && !isNaN(parseFloat(distMatch[1]))) {
      result.distance_cm = Number(parseFloat(distMatch[1]).toFixed(1));
    }

    // 3. Formato CSV numérico (ej: "24.5, 48.0, 126.0" o "24.5;48.0;126.0")
    if (result.temperature === undefined && result.distance_cm === undefined) {
      const nums = line.split(/[,\t;|]+/).map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
      if (nums.length >= 3) {
        result.temperature = Number(nums[0].toFixed(1));
        result.humidity = Number(nums[1].toFixed(1));
        result.distance_cm = Number(nums[2].toFixed(1));
      } else if (nums.length === 2) {
        result.temperature = Number(nums[0].toFixed(1));
        result.distance_cm = Number(nums[1].toFixed(1));
      } else if (nums.length === 1 && nums[0] >= 2 && nums[0] <= 450) {
        result.distance_cm = Number(nums[0].toFixed(1));
      }
    }

    return result;
  }

  async connect(onDataReceived) {
    if (onDataReceived) this.listeners.add(onDataReceived);

    if (!('serial' in navigator)) {
      throw new Error('Web Serial API no soportada. Usa Google Chrome o Microsoft Edge.');
    }

    // Si ya existe un puerto abierto y está leyendo, reutilizarlo
    if (this.port && this.isConnected && this.isReading) {
      return this.port;
    }

    let portSelected = this.port;
    if (!portSelected) {
      portSelected = await navigator.serial.requestPort();
      this.port = portSelected;
    }

    // Abrir puerto únicamente si no está ya abierto
    if (!portSelected.readable && !portSelected.writable) {
      try {
        await portSelected.open({ baudRate: 115200 });
      } catch (err) {
        if (!err.message.includes('already open')) {
          throw err;
        }
      }
    }

    this.isConnected = true;

    // Iniciar bucle de lectura sin bloquear el writable
    if (!this.isReading && portSelected.readable) {
      this.startReadingLoop(portSelected);
    }

    return portSelected;
  }

  async startReadingLoop(port) {
    if (this.isReading) return;
    this.isReading = true;

    while (this.isConnected && port && port.readable) {
      let reader = null;
      try {
        const textDecoder = new TextDecoder();
        reader = port.readable.getReader();
        this.reader = reader;

        while (this.isConnected) {
          const { value, done } = await reader.read();
          if (done) break;

          if (value && value.length > 0) {
            this.stats.bytesReceived += value.length;
            const chunk = textDecoder.decode(value, { stream: true });
            this.buffer += chunk;

            // Procesar por líneas completas delimitadas por \n o \r
            const lines = this.buffer.split(/[\r\n]+/);
            this.buffer = lines.pop() || ''; // El remanente no terminado se guarda

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              // Parsear y notificar a todos los suscriptores
              const parsed = this.parseTelemetryLine(trimmed);
              this.notify(parsed, trimmed);
            }
          }
        }
      } catch (readErr) {
        console.warn('Stream de lectura serial finalizado o pausado:', readErr);
        break;
      } finally {
        if (reader) {
          try {
            reader.releaseLock();
          } catch (e) {}
        }
        this.reader = null;
      }
    }

    this.isReading = false;
  }

  // Envío seguro de comandos sin bloquear el flujo de lectura
  async sendCommand(cmdLetter) {
    if (!this.port || !this.port.writable) return;

    try {
      const textEncoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      try {
        await writer.write(textEncoder.encode(cmdLetter + '\n'));
      } finally {
        writer.releaseLock();
      }
    } catch (err) {
      console.warn('Error al transmitir comando serie a Wall-E:', err);
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {}
      this.port = null;
    }

    this.listeners.clear();
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }
}

export const serialManager = new SerialConnectionManager();
export default serialManager;
