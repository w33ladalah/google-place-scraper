'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FilePaths = undefined;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class FilePaths {
    constructor(logger, appFolderName) {
        if (!appFolderName) throw new Error('FilePaths: application folder name not specified');
        this.appFolderName = appFolderName;

        const appFolderPath = this.appFolderPath();
        if (!_fs2.default.existsSync(appFolderPath)) {
            try {
                _fs2.default.mkdirSync(appFolderPath);
            } catch (e) {
                logger.logError(`error while creating directory ${appFolderPath} \n ${e}`);
            }

            logger.logInfo(`created folder ${appFolderPath}`);
        } else {
            logger.logInfo(`using folder ${appFolderPath}`);
        }
    }

    appFolderPath() {
        const documentsPath = _path2.default.join(_os2.default.homedir(), "Documents");

        return _path2.default.join(documentsPath, this.appFolderName);
    }

    dbFilePath() {
        return _path2.default.join(this.appFolderPath(), 'database.db');
    }

    csvFilePath() {
        return _path2.default.join(this.appFolderPath(), 'Courses.csv');
    }

    settingsPath() {
        return _path2.default.join(this.appFolderPath(), 'settings.json');
    }

    logsPath() {
        return _path2.default.join(this.appFolderPath(), 'logs.txt');
    }
}
exports.FilePaths = FilePaths;
//# sourceMappingURL=file-paths.js.map