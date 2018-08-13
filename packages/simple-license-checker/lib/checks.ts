import { LicensingInformation } from "./licensing";

// tslint:disable-next-line:no-var-requires
const spdxSatisfies = require('spdx-satisfies');

export type Validator = (license: LicensingInformation) => string[];

export function notMatching(acceptable: string[]): Validator {
    const acceptableText = acceptable.join(' OR ');
    return license => {
        if (!spdxSatisfies(license.spdxLicense, acceptableText)) {
            return [`Not an acceptable license: ${license.spdxLicense}`];
        }
        return [];
    };
}

export function noCopyright(): Validator {
    return license => {
        if (license.licenseCopyright === undefined && license.additionalCopyrightStatement === undefined) {
            return ['Unable to determine copyright'];
        }
        return [];
    };
}

export function noLicenseText(): Validator {
    return license => {
        if (license.licenseText === undefined) {
            return ['Unable to determine license text'];
        }
        return [];
    };
}

export function allOf(...vs: Validator[]): Validator {
    return license => {
        const ret: string[] = [];
        for (const v of vs) {
            ret.push(...v(license));
        }
        return ret;
    };
}

export interface ValidationResult {
    license: LicensingInformation;
    failures: string[];
}

export function validate(licenses: LicensingInformation[], validator: Validator): ValidationResult[] {
    return licenses.map(license => ({ license, failures: validator(license) }));
}