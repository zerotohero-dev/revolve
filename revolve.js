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

            worker.on('message', function(meta) {
                var message = meta.action,
                    from = meta.from;

                if (message === 'fetch-index') {
                    var workers = cluster.workers;

                    for(var key in workers) {
                        console.log('a');
                        var current = workers[key];
                        
                        if(current.id === from) {
                            console.log('b');
                            current.send({action:'update-index', data: getRandomIndex()});
                            console.log('c');
                        }
                        
                        console.log('d');
                    }
                }
            });
        }

        cluster.on('exit', function() {
            cluster.fork();
        })
    } else {
        console.log('setting new responses');

        var currentResponse;

        process.on('message', function(meta) {
            console.log('on message');
            console.log(meta);

            if (meta.action !== 'update-index') {return;}

            var index = meta.data,
                image = imageCache[index];

            

            currentResponse.statusCode = 200;
            currentResponse.setHeader('Content-Type', 'image/png');

            currentResponse.end(image);
        });

        http.createServer(function(req, res) {
            console.log('sending to process ' + req.url);

            currentResponse = res;

            process.send({action:'fetch-index', from: cluster.worker.id });

        }).listen(3005);

    }
}

putAssetsIntoMemory().then(function() {
    startForking();
});
