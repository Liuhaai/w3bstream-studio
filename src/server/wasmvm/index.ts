import { eventBus } from '@/lib/event';
import { helper } from '@/lib/helper';
export type StdIOType = {
  '@lv': 'info' | 'error';
  '@ts': number;
  msg: string;
  prefix?: string;
};

export enum ResultStatusCode {
  OK,
  UnexportedHandler,
  ResourceNotFound,
  ImportNotFound,
  ImportCallFailed,
  TransDataToVMFailed,
  TransDataFromVMFailed,
  HostInternal,
  EnvKeyNotFound,
  NoDBContext,
  // TODO following result status
  Failed = -1 // reserved for wasm invoke failed
}

export class WASM {
  wasmModuleBytes: Buffer;
  wasmModule: WebAssembly.Module;
  memory: WebAssembly.Memory;
  instance: WebAssembly.Instance;
  stdout: StdIOType[] = [];
  stderr: StdIOType[] = [];
  rid: number = Math.floor(Math.random() * 1000000);
  ctxData: string = '';

  sendEvent(data: string) {
    this.ctxData = data;
  }

  writeStdout({ message, isAsync = false }: { message: string; isAsync?: boolean }) {
    const stdio: StdIOType = { '@lv': 'info', msg: message, '@ts': new Date().getTime(), prefix: 'wasmvm - ' };
    !isAsync ? this.stdout.push(stdio) : eventBus.emit('wasmvm.stdout', stdio);
  }

  writeStderr({ message, isAsync = false }: { message: string; isAsync?: boolean }) {
    const stdio: StdIOType = { '@lv': 'error', msg: message, '@ts': new Date().getTime(), prefix: 'wasmvm - ' };
    !isAsync ? this.stderr.push(stdio) : eventBus.emit('wasmvm.stderr', stdio);
  }

  ptr2str(pointer: number) {
    const memory = this.memory;
    if (!pointer) return null;
    const end = (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let start = pointer >>> 1,
      string = '';
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }

  putUint32Le(buf: Uint8Array, vmAddr: number, val: number): Error | null {
    if (buf.length < vmAddr + 4) {
      return new Error('overflow');
    }
    new DataView(buf.buffer).setUint32(vmAddr, val, true);
    return null;
  }

  // alloc(size: number): number {
  //   const memory = new Uint8Array(this.memory.buffer);
  //   //@ts-ignore
  //   const ptr = this.instance.exports?.alloc(size);
  //   return ptr;
  // }

  /** The runtime heap memory is copied to WebAssembly's linear memory space */
  copyToWasm(hostData: string | Uint8Array, vmAddrPtr: number, vmSizePtr: number) {
    try {
      if (typeof hostData === 'string') {
        const encoded = new TextEncoder().encode(hostData);
        // @ts-ignore
        const ptr = this.instance.exports?.alloc(encoded.length);
        const hostDataView = new Uint8Array(this.memory.buffer, ptr, encoded.length);
        hostDataView.set(encoded);
        const vmAddrView = new DataView(this.memory.buffer, vmAddrPtr, 4);
        const vmSizeView = new DataView(this.memory.buffer, vmSizePtr, 4);
        vmAddrView.setInt32(0, ptr, true);
        vmSizeView.setInt32(0, encoded.byteLength, true);
      } else {
        // @ts-ignore
        const ptr = this.instance.exports?.alloc(hostData.length);
        const hostDataView = new Uint8Array(this.memory.buffer, ptr, hostData.length);
        hostDataView.set(hostData);
        const vmAddrView = new DataView(this.memory.buffer, vmAddrPtr, 4);
        const vmSizeView = new DataView(this.memory.buffer, vmSizePtr, 4);
        vmAddrView.setInt32(0, ptr, true);
        vmSizeView.setInt32(0, hostData.byteLength, true);
      }
    } catch (error) {
      throw new Error(`copyToWasmErr: ${error.message}`);
    }
  }

  vmImports: WebAssembly.Imports = {};

  constructor(wasmModuleBytes: Buffer) {
    this.wasmModuleBytes = wasmModuleBytes;
    const _this = this;
    this.vmImports = {
      wasi_snapshot_preview1: {
        fd_write() {
          return 0;
        },
        clock_time_get() {
          return 0;
        },
        args_sizes_get() {
          return 0;
        },
        args_get() {
          return 0;
        },
        environ_get() {
          return 0;
        },
        environ_sizes_get() {
          return 0;
        },
        fd_close() {
          return 0;
        },
        fd_fdstat_get() {
          return 0;
        },
        fd_prestat_get() {
          return 0;
        },
        fd_prestat_dir_name() {
          return 0;
        },
        fd_read() {
          return 0;
        },
        fd_seek() {
          return 0;
        },
        path_open() {
          return 0;
        },
        proc_exit() {
          return 0;
        }
      },
      env: {
        ws_get_env(kaddr, ksize, vaddr, vsize) {
          const k_view = new Uint8Array(_this.memory.buffer, kaddr, ksize);
          const k = new TextDecoder().decode(k_view); //{statement: string, params: any[]}
          const v = globalThis.store.w3s.projectManager.curFilesListSchema.findENV(k);
          if (!v) {
            _this.writeStderr({
              message: `env key not found: ${k}`
            });
            return ResultStatusCode.EnvKeyNotFound;
          }
          _this.copyToWasm(v, vaddr, vsize);
          return ResultStatusCode.OK;
        },
        ws_send_mqtt_msg() {
          return null;
        },
        ws_set_sql_db(ptr, size) {
          const sql_view = new Uint8Array(_this.memory.buffer, ptr, size);
          const sql = new TextDecoder().decode(sql_view); //{statement: string, params: any[]}
          //INSERT INTO \"t_log\" (f_id,f_log) VALUES (?,?);
          const sqlJSON = helper.json.safeParse(sql);
          if (!sqlJSON) {
            _this.writeStderr({
              message: `sql parse error: ${sql}`
            });
            return;
          }
          const sqlStatement = globalThis.store.god.sqlDB.toSQL(sqlJSON);
          try {
            globalThis.store.god.sqlDB.exec(sqlStatement);
            _this.writeStdout({
              message: `run sql ${sqlStatement}`
            });
            eventBus.emit('sql.change');
          } catch (e) {
            console.log(e);
            _this.writeStderr({
              message: `sql run error: ${e.message}`
            });
          }
        },
        ws_get_sql_db(ptr, size, vmAddr, vmSizePtr) {
          const sql_view = new Uint8Array(_this.memory.buffer, ptr, size);
          const sql = new TextDecoder().decode(sql_view);
          const sqlJSON = helper.json.safeParse(sql);
          if (!sqlJSON) {
            _this.writeStderr({
              message: `sql parse error: ${sql}`
            });
            return;
          }
          const sqlStatement = globalThis.store.god.sqlDB.toSQL(sqlJSON);
          try {
            const res = globalThis.store.god.sqlDB.exec(sqlStatement);
            console.log(globalThis.store.god.sqlDB.parseResult(res));
            const resStr = JSON.stringify(globalThis.store.god.sqlDB.parseResult(res));
            _this.copyToWasm(resStr, vmAddr, vmSizePtr);
          } catch (e) {
            console.log(e);
            _this.writeStderr({
              message: `sql run error: ${e.message}`
            });
          }
        },
        ws_get_data(rid: number, data_ptr: number, data_size: number): number {
          const data = _this.ctxData;
          console.log(data, 'ctxData', data_ptr, data_size);
          try {
            _this.copyToWasm(data, data_ptr, data_size);
            return ResultStatusCode.OK;
          } catch (error) {
            console.log(error);
            return ResultStatusCode.ResourceNotFound;
          }
        },
        ws_call_contract(chainId: number, tx_ptr: number, tx_size: number, vmAddrPtr: number, vmSizePtr: number): number {
          const inputView = new Uint8Array(_this.memory.buffer, tx_ptr, tx_size);
          const vmSizeView = new DataView(_this.memory.buffer, vmSizePtr, 4);
          const vmAddrView = new Uint8Array(_this.memory.buffer, vmAddrPtr, 4);
          const input = new TextDecoder().decode(inputView);
          const { to, data } = helper.json.safeParse(input);
          let callRes;
          if (to && data) {
            try {
              const res = helper.c.callContractSync({ chainId, to, data: data });
              callRes = res;
              console.log('callRes');
            } catch (e) {
              console.log(e);
            }
          }
          console.log(callRes);
          const bytes = new Uint8Array(callRes.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            const byteString = callRes.substr(i * 2, 2);
            bytes[i] = parseInt(byteString, 16);
          }
          _this.copyToWasm(bytes, vmAddrPtr, vmSizePtr);
          return ResultStatusCode.OK;
        },
        async ws_send_tx(chainID: number, offset: number, size: number, vmAddrPtr: number, vmSizePtr: number) {
          try {
            const inputView = new Uint8Array(_this.memory.buffer, offset, size);
            const vmSizeView = new DataView(_this.memory.buffer, vmSizePtr, 4);
            const vmAddrView = new Uint8Array(_this.memory.buffer, vmAddrPtr, 4);
            const input = new TextDecoder().decode(inputView);
            const jsonInput = helper.json.safeParse(input);
            console.log(jsonInput);
            helper.c.sendTx({
              chainId: chainID,
              address: jsonInput.to,
              data: '0x' + jsonInput.data,
              value: jsonInput.value,
              onSuccess: (tx) => {
                console.log(tx);
                _this.writeStdout({
                  message: `call ws_send_tx `,
                  isAsync: true
                });
              }
            });
            // vmAddrView.set(txEncoded);
            // vmSizeView.setInt32(0, txEncoded.length, true);
            return ResultStatusCode.OK;
          } catch (error) {
            console.error(error);
            return ResultStatusCode.Failed;
          }
        },
        ws_set_db(key_ptr, key_size, value_ptr, value_size) {
          try {
            const key_view = new Uint8Array(_this.memory.buffer, key_ptr, key_size);
            const key = new TextDecoder().decode(key_view);
            const value_view = new Uint8Array(_this.memory.buffer, value_ptr, value_size);
            const value = new TextDecoder().decode(value_view);
            if (window) {
              window?.localStorage.setItem(key, value);
            }
            _this.writeStdout({ message: `call ws_set_db ${key}: ${value}` });
            return ResultStatusCode.OK;
          } catch (error) {
            return ResultStatusCode.Failed;
          }
        },
        ws_get_db(key_ptr, key_size, rAddrPtr, rSizePtr) {
          try {
            const key_view = new Uint8Array(_this.memory.buffer, key_ptr, key_size);
            const key = new TextDecoder().decode(key_view);
            const value = window?.localStorage.getItem(key);
            if (value) {
              _this.copyToWasm(value, rAddrPtr, rSizePtr);
              _this.writeStdout({ message: `call ws_get_db ${key}: ${value}` });
              return ResultStatusCode.OK;
            }
          } catch (error) {
            return ResultStatusCode.Failed;
          }
        },
        ws_log(logLevel: number, ptr: number, size: number) {
          try {
            const view = new Uint8Array(_this.memory.buffer, ptr, size);
            const message = new TextDecoder().decode(view);
            _this.writeStdout({ message });
            return ResultStatusCode.OK;
          } catch (error) {
            return ResultStatusCode.Failed;
          }
        },
        abort(message: any, fileName: any, lineNumber: number, columnNumber: number) {
          message = _this.ptr2str(message >>> 0);
          fileName = _this.ptr2str(fileName >>> 0);
          lineNumber = lineNumber >>> 0;
          columnNumber = columnNumber >>> 0;
          console.log(message, fileName, lineNumber, columnNumber);
          _this.writeStdout({ message });
          return ResultStatusCode.OK;
        }
      }
    };
  }

  async start(start_func = 'start', throw_error = true): Promise<{ stdout: StdIOType[]; stderr: StdIOType[] }> {
    try {
      this.wasmModule = await WebAssembly.compile(this.wasmModuleBytes);
      this.instance = await WebAssembly.instantiate(this.wasmModule, this.vmImports);
      console.log(this.instance);
      this.memory = this.instance.exports.memory as WebAssembly.Memory;
      //@ts-ignore
      const res = eval(`this.instance.exports?.${start_func}(this.rid)`);
      // this.writeStdout({ message: `rid:${res}` });
    } catch (error) {
      console.log(error);
      this.writeStderr({ message: error.message });
      if (throw_error) {
        throw new Error(error);
      }
    }
    return {
      stdout: this.stdout,
      stderr: this.stderr
    };
  }
}
