var logger = require('./logger');
var Client = require('node-rest-client').Client;
var fs = require('fs');

module.exports = function PublicPackageStore(config) {
    var _packages = {};

    var publicBowerUrl = config.publicRegistry || 'http://bower.herokuapp.com/packages/';

    _init();
    function _init() {
        logger.log('Refreshing public packages...');
        if(fs.existsSync(config.registryFilePublic)) {
          _parsePackage(fs.readFileSync(config.registryFilePublic));
          logger.log("Cached public packages loaded");
        }
        
        _loadPublicPackagesPeriodically();
    }

    function _getPackage(packageName) {
        return _packages[packageName];
    }
    
    function _parsePackage(data) {
        var jsonData = JSON.parse(data);
        for(var i = 0, len = jsonData.length; i < len; i++) {
            var item = jsonData[i];
            _packages[item.name] = item;
        }
    }

    function _loadPublicPackagesPeriodically() {
        var client = createClient();

        client.get(publicBowerUrl, function(data) {
            processData(data);
        }).on('error', function(err) {
            console.log('something went wrong on the request', err.request.options);
        });

        client.on('error', function(err) {
            console.error('Something went wrong on the client', err);
        });

        function processData(data) {
            try {
                _parsePackage(data);
                fs.writeFile(config.registryFilePublic, data, function(err) {
                  logger.log(err ? 'Error cache public package' : 'public package cached');
                });
                logger.log('Loaded public packages');

            } catch (e) {
                logger.error('Could not load public packages: data=' + data);
            }
        }

        function createClient() {
            var clientOptions;

            if(config.proxySettings && config.proxySettings.enabled) {
                clientOptions = {
                    proxy: {
                        host: config.proxySettings.host,
                        port: config.proxySettings.port,
                        user: config.proxySettings.username,
                        password: config.proxySettings.password,
                        tunnel: config.proxySettings.tunnel
                    }
                };
            }

            return new Client(clientOptions);
        }

        // re-schedule the function
        setTimeout(_loadPublicPackagesPeriodically, 1000 * 60 * 30);
    }

    function _searchPackage(name) {
        var searchName = name.toLowerCase();
        var packages = [];

        for(var packageName in _packages) {
            if(_packages.hasOwnProperty(packageName) &&
                packageName.toLowerCase().indexOf(searchName) !== -1) {

                var item = _packages[packageName];
                packages.push({
                    name: item.name,
                    url: item.repo
                });
            }
        }

        return packages;
    }

    return {
        getPackage: _getPackage,
        searchPackage: _searchPackage
    };
};