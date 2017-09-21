import { awesomeIncluded } from "awesome-lib-with-included-type-definition";
awesomeIncluded("Should work now");

import { awesomeExternal } from "awesome-lib-with-external-type-definition";
awesomeExternal("Should work now");

import { awesomePatched } from "awesome-lib-with-patched-type-definition";
awesomePatched("Should work now");
