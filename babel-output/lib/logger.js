'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Logger = undefined;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Logger {
    constructor() {
        if (process.versions.electron) {
            this._htmlLogger = document.getElementById('logger');
        }

        this._logs = [];
    }

    logInfo(msg) {
        this.log(msg);
    }

    logError(msg) {
        this.log(msg, 'color: red;');
    }

    log(msg, style) {
        if (!msg) return;

        if (this._htmlLogger) {
            this._htmlLogger.insertAdjacentHTML('beforeend', `\n <p style="${style || 'color: black;'}">${msg}</p>`);
            // Scroll to bottom
            this._htmlLogger.scrollTop = this._htmlLogger.scrollHeight;
        } else {
            console.log(msg);
        }

        this._logs.push(msg);
    }

    exportLogs(path) {
        return new Promise((resolve, reject) => {
            _fs2.default.writeFile(path, this._logs.join('\n'), err => {
                resolve();
            });
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map