const fse = require('fs-extra');
const mapRecursive = require('map-recursive');

const traversePath = async (path, callback) => {
    const stat = await fse.stat(path);
    if (!stat.isDirectory()) {
        await callback.onFile(path);
        return path;
    }
    await callback.onDir(path);
    const files = await fse.readdir(path);
    return Promise.all(files.map(async v => await traversePath(`${path}/${v}`, callback)));
};

(async () => {
    await fse.ensureDir('transformed');

    function convertPath(f) {
        return f.replace(/^original/, 'transformed');
    }

    await traversePath('original', {
        onDir: async f => await fse.ensureDir(convertPath(f)),
        onFile: async f => {
            const content = await fse.readFile(f, 'utf-8');
            console.log(f);

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
            const c2 = mapRecursive.mapRecursiveKey( c1, v => v.replace?.(/^(@|rdf:|rdfs:|schema:|http:\/\/schema.org\/)/, "") ?? v);
            const c3 = mapRecursive.mapRecursiveLeaf(c2, v => v.replace?.(/^(@|rdf:|rdfs:|schema:|http:\/\/schema.org\/)/, "") ?? v);
            const json = JSON.stringify(c3, null, 4);
            return await fse.writeFile(convertPath(f), json, 'utf-8')
        }
    });

    [
        {
            pathTree: 'transformed/5.0/tree.jsonld',
            pathTreePruned: 'transformed/5.0/tree.pruned.jsonld',
        },
        {
            pathTree: 'transformed/14.0/tree.jsonld',
            pathTreePruned: 'transformed/14.0/tree.pruned.jsonld',
        },
        {
            pathTree: 'transformed/26.0/tree.jsonld',
            pathTreePruned: 'transformed/26.0/tree.pruned.jsonld',
        },
    ].reduce(async (a, v) => {
        await a;
        const {pathTree, pathTreePruned } = v;

        const text = await fse.readFile(pathTree, 'utf-8');
        const tree = JSON.parse(text);
        const treePruned = mapRecursive.mapRecursiveLeaf(
            tree,
            (v, k) => ['id', 'children'].includes(k) ? v : undefined
        );
        const filtered = mapRecursive.mapRecursive(treePruned, v => {
            if(typeof v !== 'object')
                return v;

            if(Array.isArray(v))
                return v;

            Object.keys(v).filter(k => !['id', 'children'].includes(k)).map(k => delete v[k]); // TODO: need to be pure function
            return v;
        });
        const result = JSON.parse(JSON.stringify(filtered));
        await fse.writeFile(pathTreePruned, JSON.stringify(result, null, 4), 'utf-8')
        return [];
    }, [])
})();
