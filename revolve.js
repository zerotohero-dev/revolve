var cluster = require('cluster'),
    http = require('http'),
    os = require('os'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),

    cpuCount = os.cpus().length,

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

function getRandomIndex() {
    return Math.floor(Math.random()*(imageCache.length+1));
}

function startForking() {
    var i, len, currentIndex = 0;

    if (cluster.isMaster) {
        for(i = 0, len = cpuCount; i < len; i++) {
            var worker = cluster.fork();

            worker.on('message', function(message) {
                if (message === 'fetch-index') {

                    worker.send({action:'update-index', data: getRandomIndex()});
                }
            });
        }

        cluster.on('exit', function() {
            cluster.fork();
        })
    } else {
        var currentResponse = null;

        http.createServer(function(req, res) {
            console.log('sending to process');
            currentResponse = res;

            process.send('fetch-index');
        }).listen(3005);

        process.on('message', function(meta) {
            console.log('on message');

            if (meta.action !== 'update-index') {return;}

            var index = meta.data,
                image = imageCache[index];

            console.log(currentResponse);

            currentResponse.statusCode = 200;
            currentResponse.setHeader('Content-Type', 'image/png');

            currentResponse.end(image);
        });
    }
}

putAssetsIntoMemory().then(function() {
    startForking();
});
