const { existsSync, statSync, readdirSync } = require('fs');
const serialize = require('serialize-javascript');
const atob      = require('atob');
const btoa      = require('btoa');
const File      = require('./File.js');

class Cache
{
    constructor(directory)
    {
        directory           = this.sanitizeDir(directory);
        this.validateDir(directory);
        this.directory      = directory;
        this.files          = {};
    }

    /**
     * @param string key Unique identifier
     * @param mixed default Fallback value
     * @return promise
     */
    async get(key, defaultV = null)
    {
        this.validateKey(key);

        if (! this.setted(key)) {
            return this.successPromise(defaultV);
        }

        if (this.expired(key)) {
            this.delete(key);
            return this.successPromise(defaultV);
        }

        return this.load(key);
    }

    successPromise(data)
    {
        return new Promise(function(success, fail)
        {
            success(data);
        })
    }

    /**
     * @param string key Unique identifier
     * @param mixed value
     * @param null|int|\DateInterval ttl Time to live
     * @return Promise
     */
    async set(key, value, ttl = null)
    {
        this.validateKey(key);
        this.validateTtl(ttl);

        var expiration = 1;

        if (ttl) {
            expiration = this.properTimestamp(ttl);
        }

        return this.save(key, value, expiration);
    }

    /**
     * @param string key Unique identifier
     * @return Promise
     */
    async delete(key)
    {
        this.validateKey(key);
        return this.getFile(key).delete();
    }

    /**
     * Clear the entire cache
     * @return Promise
     */
    async clear()
    {
        var gxi = this;
        new Promise(function(success, fail)
        {
            var files   = gxi.getAllCacheRelatedFiles();
            var n       = 0;

            for (var file of files) {
                gxi.getFile(file).delete().then(function()
                {
                    n++;
                    if (n == files.length) {
                        success();
                    }
                });
            }
        });
    }

    /**
     * @param array keys
     * @param mixed default
     * @return Promise
     */
    async getMultiple(keys, defaultV = null)
    {
        var gxi = this;


        return new Promise(function(success, fail)
        {
            var ret = {};
            var n = 0;
            for (let key of keys) {
                gxi.get(key, defaultV).then(function(data)
                {
                    ret[key] = data;
                    n++;
                    if (n == keys.length) {
                        success(ret);
                    }
                });
            }
        });

    }

    /**
     * @param Object values key-value pairs
     * @param null|int|DateInterval ttl Time to live
     * @param Promise
     */
    setMultiple(values, ttl = null)
    {
        var gxi = this;
        return new Promise(function(success, fail)
        {
            var n = 0;
            for (var key in values) {
                var value = values[key];
                gxi.set(key, value, ttl).then(function()
                {
                    n++;
                    if (n == Object.keys(values).length) {
                        success();
                    }
                })
            }
        });
    }

    /**
     * @param array keys
     * @param Promise
     */
    async deleteMultiple(keys)
    {
        var gxi = this;
        return new Promise(function(success, fail)
        {
            var n = 0;
            for (var key of keys) {
                gxi.delete(key).then(function()
                {
                    if (n == keys.length) {
                        success();
                    }
                });
            }
        })
    }

    /**
     * @param string key
     * @return bool
     */
    has(key)
    {
        this.validateKey(key);
        return this.setted(key);
    }

    lock(key)
    {
        return this.getFile(key).lock();
    }

    unlock(key)
    {
        return this.getFile(key).unlock();
    }

    /**
     * Evaluates if key is a valid PSR-16 id
     * @param string key
     * @return bool
     */
    isValidKey(key)
    {
        // valid:                A-Za-z0-9_.
        // valid by extension:   çãâéõ ... etc
        // invalid:              {}()/\@:

        return ! /[\{\}\(\)\/\\\@]/.test(key);
    }

    /**
     * Strip a string from invalid characters so
     * it may be use as a valid cache key
     */
    normalizeKey(key)
    {
        return key.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    }

    /**
     * @param string key Unique identifier
     * @return bool
     */
    expired(key)
    {
        return this.getFile(key).expired;
    }

    /*----------------------------------------------------*/

    /**
     * @param string key Unique identifier
     * @return bool
     */
    setted(key)
    {
        return this.getFile(key).exists;
    }

    /**
     * Encode and saves content
     * @param string key Unique identifier
     * @param mixed content
     * @return Promise
     */
    async save(key, content, expiration = 1)
    {
        var file = this.getFile(key);

        return file.write(this.encode(content)).then(function()
        {
            file.setExpiration(expiration);
        });
    }

    /**
     * Loads and decode content
     * @param string key Unique identifier
     * @param mixed
     */
    async load(key)
    {
        var gxi = this;
        return this.getFile(key).read().then(function(data)
        {
            return gxi.decode(data);
        });
    }

    /**
     * Returns a timestamp based on the current time plus a an interval
     * @param   int|\DateInterval timeToLive
     * @return  int|\DateInterval seconds timestamp
     */
    properTimestamp(timeToLive)
    {
        return new Date(Date.now() + timeToLive);
    }

    /**
     * @param mixed content
     * @return string
     */
    encode(content)
    {
        var encoded = btoa(serialize(content));
        return encoded;
        //return addslashes(encoded);
    }

    /**
     * @param string content
     * @return mixed
     */
    decode(content)
    {
        return this.deserialize(atob(content));
    }

    deserialize(serializedJavascript)
    {
        return eval('('+serializedJavascript+')');
    }

    getFile(keyFile)
    {
        var file, key;

        if (this.isValidCacheFileName(keyFile)) {
            file = keyFile;
            key  = keyFile.match(/cache-([^.]+)\.txt$/)[1];
        } else {
            key  = keyFile;
            file = this.getCachePath(key);
        }

        if (this.files[key] == undefined) {
            this.files[key] = new File(file);
        }

        return this.files[key];
    }

    closeAllFiles()
    {
        for (var key in this.files) {
            this.files[key].close();
        }

        this.files = {};
    }

    getAllCacheRelatedFiles()
    {
        var dir     = this.directory;
        var entries = readdirSync(this.directory);

        entries.map(function(value, key)
        {
            entries[key] = dir+value;
        });

        return entries.filter(this.isValidCacheFileName);
    }

    validateKey(key)
    {
        if (! this.isValidKey(key)) {
            throw '"'+key+'" is an invalid cache ID';
        }
    }

    validateTtl(ttl)
    {
        if (! this.validTtl(ttl)) {
            throw 'Invalid time to live';
        }
    }

    validateDir(directory)
    {
        if (! existsSync(directory)) {
            throw 'Directory '+directory+' doesn\'t exists';
            return false;
        }

        var st = statSync(directory);

        if (! st.isDirectory()) {
            throw directory+' is not a directory';
            return false;
        }

        /*
        if (! is_writable(directory)) {
            throw directory+' is not writable';
            return false;
        }

        if (! is_readable(directory)) {
            throw directory+' is not readable';
            return false;
        }
        */

        return true;
    }

    isValidCacheFileName(string)
    {
        return /cache-[A-Za-z0-9_.]*\.txt$/.test(string);
    }

    validTtl(ttl)
    {
        // ttl instanceof DateInterval
        return Number.isInteger(ttl) || ttl == null;
    }

    sanitizeDir(directory)
    {
        return directory.replace(/\\/g, '/').replace(/\/$/, '')+'/';
    }

    getCachePath(key)
    {
        return this.directory+this.getCachedFileName(key);
    }

    getCachedFileName(key)
    {
        return 'cache-'+key+'.txt';
    }
}

module.exports = Cache;
