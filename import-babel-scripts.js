const path = require('path');
const fs = require('fs');

// Constants
const babelOutputFolderName = 'babel-output';
const htmlFiles = ['./index.html', './restricted.html'];

// Main
const babelOutputDirectory = path.join(__dirname, babelOutputFolderName);
const filesToAdd = getFolderFiles(babelOutputDirectory)
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(babelOutputDirectory, `./${babelOutputFolderName}`))
    .map(f => f.replace(/\\/g, '\/'))
    .map(f => `require('${f}');`);

htmlFiles.forEach(htmlFile => {
    let input = fs.readFileSync(htmlFile, "utf8");//.replace(/[\r\n]+/g," ");
    const startIndex = input.indexOf('<script>') + 8;
    const endIndex = input.indexOf('<\/script>');
    input = input.substring(0, startIndex)
        + '\n'
        + filesToAdd.join('\n')
        + '\n'
        + input.substring(endIndex);

    fs.writeFileSync(htmlFile, input);
});

function getFolderFiles(dir, filelist) {
    filelist = filelist || [];
    files = fs.readdirSync(dir);
    files.forEach(function(file) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            filelist = getFolderFiles(filePath, filelist);
        }
        else {
            filelist.push(filePath);    //or just the filename: filelist.push(file);
        }
    });
    return filelist;
};
