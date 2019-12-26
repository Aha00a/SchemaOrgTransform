const fse = require('fs-extra');
const mapRecursive = require('map-recursive');

const traversePath = async (path, callback) => {
    const stat = await fse.stat(path);
    if (!stat.isDirectory()) {
        callback.onFile(path);
        return path;
    }
    callback.onDir(path);
    const files = await fse.readdir(path);
    return files.map(async v => await traversePath(`${path}/${v}`, callback))
};

(async () => {
    await fse.ensureDir('transformed');

    function convertPath(f) {
        return f.replace(/^original/, 'transformed');
    }

    await traversePath('original', {
        onDir: async f => {
            await fse.ensureDir(convertPath(f));
        },
        onFile: async f => {
            const content = await fse.readFile(f, 'utf-8');

            const c1 = mapRecursive.mapRecursive(JSON.parse(content), v => {
                if (typeof v !== 'object')
                    return v;

                const keys = Object.keys(v);
                if (keys.length !== 1)
                    return v;

                if (keys[0] !== '@id')
                    return v;

                return v['@id'];
            });
            const c2 = mapRecursive.mapRecursiveKey( c1, v => v.replace(/^(@|rdf:|rdfs:|schema:|http:\/\/schema.org\/)/, ""));
            const c3 = mapRecursive.mapRecursiveLeaf(c2, v => v.replace(/^(@|rdf:|rdfs:|schema:|http:\/\/schema.org\/)/, ""));
            const json = JSON.stringify(c3, null, 4);
            await fse.writeFile(convertPath(f), json, 'utf-8')
        }
    });
})();
