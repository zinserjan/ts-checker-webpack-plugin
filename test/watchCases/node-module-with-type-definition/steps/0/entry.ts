import { awesomeIncluded } from "awesome-lib-with-included-type-definition";
awesomeIncluded(2);

import { awesomeExternal } from "awesome-lib-with-external-type-definition";
awesomeExternal(null);

import { awesomePatched } from "awesome-lib-with-patched-type-definition";
awesomePatched(undefined);
