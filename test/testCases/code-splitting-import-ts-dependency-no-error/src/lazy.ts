const x: number = 4;
export default x;

System.import("./lazy2").then(x => {
  console.log(x);
});
