var cluster = require('cluster'),
    http = require('http'),
    os = require('os'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),

    imageCache = [];

function readFile(file) {
    var deferred = Q.defer();

    fs.readFile(path.join(__dirname, 'assets', file), function(err, data) {
        deferred.resolve(data);
    });

    return deferred.promise;
}
function putAllToMemory(files) {
    var promises = [];

    files.forEach(function(file) {
        promises.push(readFile(file).then(function(data) {
            imageCache.push(data);
        }));
    });

    return Q.all(promises);
}

function getFileList() {
    var dir = path.join(__dirname, 'assets'),
        deferred = Q.defer();

    fs.readdir(dir, function(err, files) {
        deferred.resolve(files);
    });

    return deferred.promise;
}

function putAssetsIntoMemory() {
    return getFileList().then(function(files) {
        return putAllToMemory(files);
    });
}

function startForking() {
    
}

putAssetsIntoMemory().then(function() {
    startForking();
});
