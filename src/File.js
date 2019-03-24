const { promises, existsSync, statSync } = require('fs');
const touch         = require('touch');
const lockfile      = require('proper-lockfile');

class File
{
    constructor(path)
    {
        this.path       = path;
        this.file       = null;
        this.locked     = false;
    }

    get exists()
    {
        return this.doesExists();
    }

    get expiration()
    {
        return this.getExpiration();
    }

    get expired()
    {
        return this.isExpired();
    }

    async read()
    {
        return promises.readFile(this.path, 'utf8');
    }

    /**
     * @param string
     * @return bool
     */
    async write(content)
    {
        return promises.writeFile(this.path, content, 'utf8');
    }

    doesExists()
    {
        return existsSync(this.path);
    }

    /**
     * @return null|int timestamp
     */
    getExpiration()
    {
        if (! this.exists) {
            return null;
        }

        return statSync(this.path).mtimeMs;
    }

    /**
     * @param string key Unique identifier
     * @return bool
     */
    isExpired()
    {
        var exp = this.getExpiration();
        if (exp == null || exp == 1 || exp == 0) {
            return false;
        }

        return Date.now() >= this.expiration;
    }

    /**
     * @param string key Unique identifier
     * @param int timestamp
     */
    setExpiration(time)
    {
        return touch.sync(this.path, {time: time});
    }

    async delete()
    {
        if (this.exists) {
            return promises.unlink(this.path);
        }

        return this.successPromise(true);
    }

    /**
     * @return bool
     */
    lock()
    {
        return this.locked = lockfile.lockSync(this.path);
    }

    /**
     * @return bool
     */
    unlock()
    {
        return this.locked = !lockfile.unlockSync(this.path);
    }


    successPromise(data)
    {
        return new Promise(function(success, fail)
        {
            success(data);
        })
    }
}

module.exports = File;
