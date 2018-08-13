import fs = require('fs');
import path = require('path');
import util = require('util');
import { PackageInfo } from "./locating";

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

// tslint:disable-next-line:no-var-requires
const spdxCorrect = require('spdx-correct');

export interface LicensingInformation {
    /**
     * Name and version of the package
     */
    packageIdentifier: string;

    /**
     * How is this package included
     */
    includePath: string[];

    /**
     * The declared license
     */
    declaredLicenses: string[];

    /**
     * The standardized license type, if available
     */
    spdxLicense?: string;

    /**
     * License text
     */
    licenseText?: string;

    /**
     * Package homepage
     */
    homepage?: string;

    /**
     * License found in copyright
     */
    licenseCopyright?: string;

    /**
     * Copyright statement if NOT in licenseText.
     */
    additionalCopyrightStatement?: string;
}

/**
 * Determine license for a package from a located package
 */
export async function determineLicense(packageInfo: PackageInfo): Promise<LicensingInformation> {
    // First off, we should be trying the "license" field.
    const declaredLicenses: string[] = [];
    if (typeof packageInfo.packageJson.license === 'string') {
        declaredLicenses.push(packageInfo.packageJson.license);
    }

    // Some packages may declare legacy formats, try to parse these as well.
    // https://docs.npmjs.com/files/package.json
    if (typeof packageInfo.packageJson.license === 'object' && packageInfo.packageJson.license.type) {
        declaredLicenses.push(packageInfo.packageJson.license.type);
    }

    if (Array.isArray(packageInfo.packageJson.licenses)) {
        for (const lic of packageInfo.packageJson.licenses) {
            if (typeof lic.type === 'string') {
                declaredLicenses.push(lic.type);
            }
        }
    }

    // Turn into undefined if empty string
    const spdxLicense = declaredLicenses.map(spdxCorrect).join(' OR ') || undefined;
    const licenseText = await loadFileLike(packageInfo.directory, 'LICENSE');

    // If we find a copyright notice in the license text we found, we're done.
    const licenseCopyright = findCopyrightStatement(licenseText);
    let additionalCopyrightStatement: string | undefined;
    if (!licenseCopyright) {
        // If not, try to find in README
        additionalCopyrightStatement = findCopyrightStatement(await loadFileLike(packageInfo.directory, 'README'));

        // If still not found, construct one from the author information found in package.json
        if (!additionalCopyrightStatement) {
            const author = packageInfo.packageJson.author || {};
            const authorParts = [author.name, author.email, author.url].filter(x => x !== undefined);
            if (authorParts.length > 0) {
                additionalCopyrightStatement = `Copyright (c) ${authorParts.join(' ')}`;
            }
        }
    }

    return {
        packageIdentifier: packageInfo.identifier,
        includePath: packageInfo.path.map(p => p.identifier),
        declaredLicenses,
        spdxLicense,
        licenseText,
        homepage: packageInfo.packageJson.homepage,
        licenseCopyright,
        additionalCopyrightStatement
    };
}

/**
 * Search the directory for a file that case insensitively has a prefix and load it
 */
async function loadFileLike(directory: string, prefix: string): Promise<string|undefined> {
    prefix = prefix.toLowerCase();

    for (const fileName of await readdir(directory)) {
        if (fileName.toLowerCase().startsWith(prefix)) {
            return await readFile(path.join(directory, fileName), { encoding: 'utf-8' });
        }
    }
    return undefined;
}

/**
 * Try and find a copyright statement in the given text.
 */
function findCopyrightStatement(text: string | undefined): string | undefined {
    if (!text) { return undefined; }

    // Find the text line containing one of these markers
    const m = (/Copyright|\\(c\\)|©|©️/i).exec(text);
    if (!m) { return undefined; }

    let start = m.index;
    let end = m.index;
    while (start > 0 && text[start - 1] !== '\n') { start--; }
    while (end < text.length && text[end] !== '\n') { end++; }

    return text.substring(start, end);
}