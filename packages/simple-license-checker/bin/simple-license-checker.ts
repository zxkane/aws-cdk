#!/usr/bin/env node
import path = require('path');
import 'source-map-support/register';
import util = require('util');
import yargs = require('yargs');
import { determineLicense, LicensingInformation, locatePackages } from '../lib';
import { allOf, noCopyright, notMatching, validate, noLicenseText } from '../lib/checks';

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
    const infos = withoutDuplicates(await allLicenses());

    const validated = validate(infos, allOf(
        noCopyright(),
        noLicenseText(),
        notMatching(PERMISSIVE_LICENSES)));

    const withFailures = validated.filter(v => v.failures.length > 0);

    if (withFailures.length === 0) {
        return;
    }

    for (const invalid of withFailures) {
        const included = invalid.license.includePath.length > 0 ? ` (via ${invalid.license.includePath.join(', ')})` : '';
        process.stdout.write(`${invalid.license.packageIdentifier}${included}\n`);
        for (const failure of invalid.failures) {
            process.stdout.write(`- ${failure}\n`);
        }
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

async function allLicenses(): Promise<LicensingInformation[]> {
    const infos = await locatePackages('.');
    return Promise.all(infos.map(packageInfo => determineLicense(packageInfo)));
}

function withoutDuplicates(licenses: LicensingInformation[]): LicensingInformation[] {
    const ret = new Map<string, LicensingInformation>();
    for (const license of licenses) {
        const id = license.packageIdentifier + '-' + license.declaredLicenses;
        ret.set(id, license);
    }
    return Array.from(ret.values());
}

main().catch(err => {
    // tslint:disable-next-line:no-console
    console.error(err.stack);
    process.exit(1);
});