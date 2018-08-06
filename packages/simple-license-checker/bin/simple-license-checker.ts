#!/usr/bin/env node
import fs = require('fs');
import path = require('path');
import 'source-map-support/register';
import util = require('util');
import yargs = require('yargs');
import { locatePackages } from '../lib';

const exists = util.promisify(fs.exists);

// tslint:disable-next-line:no-var-requires
const nlv = require('node-license-validator');

interface NLVResults {
    packages: {[pkg: string]: string};
    licenses: string[];
    invalids: string[];
}

const argv = yargs
    .option('allow-licenses', { type: 'array', alias: 'a', desc: 'Additional licenses to allow', default: [] })
    .option('allow-packages', { type: 'array', alias: 'a', desc: 'Packages to allow by default', default: [] })
    .argv;

/**
 * Set of permissive licenses allowed by default
 */
const PERMISSIVE_LICENSES = [
    // MIT variants
    'MIT', 'ISC', 'MIT/X11',
    // BSD variants
    'BSD', 'BSD-2-Clause', 'BSD-3-Clause',
    // Public domain
    'CC0-1.0',
    'Unlicense',
    // Creative Commons
    'CC-BY-3.0',
    // Organizations
    'Apache-2.0',
    'Apache 2.0',
    'PSF',
];

async function main() {
    const infos = await locatePackages('.');
    for (const info of infos) {
        const fullName = `${info.packageJson.name}@${info.packageJson.version}`;
        const homepage = info.packageJson.homepage;
        const license = info.packageJson.license;
        const lics = info.packageJson.licenses;
        const hasLICENSE = await exists(path.join(info.directory, 'LICENSE'));
        const hasCOPYRIGHT = await exists(path.join(info.directory, 'COPYRIGHT'));
        const hasNOTICE = await exists(path.join(info.directory, 'NOTICE'));

        // tslint:disable-next-line:no-console max-line-length
        console.log(fullName, homepage, license || 'NOLICENSE', lics, hasLICENSE ? '' : 'NOFILE', hasCOPYRIGHT ? 'COPYRIGHT' : '', hasNOTICE ? 'NOTICE' : '');
    }

    const settings = require(path.join(process.cwd(), 'package.json'))["simple-license-checker"] || {};

    const licenses = PERMISSIVE_LICENSES.concat(argv['allow-licenses']).concat(settings["allow-licenses"] || []);
    const packages = argv['allow-packages'].concat(Object.keys(settings["allow-packages"] || {}));

    const results: NLVResults = await util.promisify(nlv)('.', { licenses, packages });

    if (results.invalids.length > 0) {
        process.stderr.write('Uses dependencies with nonpermissive (or unknown) licenses:\n');
        results.invalids.forEach(pkg => {
            const license = results.packages[pkg];
            process.stderr.write(`* ${pkg} => ${license}\n`);
        });

        process.exit(1);
    }
}

main().catch(err => {
    // tslint:disable-next-line:no-console
    console.error(err);
    process.exit(1);
});
