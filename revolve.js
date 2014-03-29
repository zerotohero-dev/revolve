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
    var i, len;

    if (cluster.isMaster) {
        for(i = 0, len = cpuCount; i < len; i++) {
            var worker = cluster.fork();

            worker.on('message', function(meta) {
                var message = meta.action,
                    from = meta.from;

                if (message === 'fetch-index') {
                    var workers = cluster.workers;

                    for(var key in workers) {
                        var current = workers[key];

                        if(current.id === from) {
                            current.send({action:'update-index', data: getRandomIndex()});
                        }
                    }
                }
            });
        }

        cluster.on('exit', function() {
            cluster.fork();
        });
    } else {
        var currentResponse;

        process.on('message', function(meta) {
            if (meta.action !== 'update-index') {return;}

            var index = meta.data,
                image = imageCache[index];

            currentResponse.statusCode = 200;
            currentResponse.setHeader('Content-Type', 'image/png');

            currentResponse.end(image);
        });

        http.createServer(function(req, res) {
            currentResponse = res;

            process.send({action:'fetch-index', from: cluster.worker.id });
        }).listen(3005);
    }
}

putAssetsIntoMemory().then(function() {
    startForking();
});
