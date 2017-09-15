const x: string = "";
export default x;

import("./lazy2").then(x => {
  console.log(x);
});
