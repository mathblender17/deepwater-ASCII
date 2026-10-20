import { assertEquals } from "jsr:@std/assert@1.0.8";
import { entryProblem } from "./pack.ts";

Deno.test("an entry needs an image and a body colour", () => {
  assertEquals(entryProblem({ pose: "a.png", colors: { body: "#ffffff" } }), null);
  assertEquals(entryProblem({ head: "a.png", colors: { body: "#ffffff" } }), null);
  assertEquals(entryProblem({ pose: "a.png", colours: { body: "#ffffff" } }), "no colors.body");
  assertEquals(entryProblem({ pose: "a.png", colors: { belly: "#ffffff" } }), "no colors.body");
  assertEquals(entryProblem({ colors: { body: "#ffffff" } }), "no pose or head image");
  assertEquals(entryProblem({ pose: "a.png", colors: { body: "white" } }), "colors.body is not a #rrggbb colour");
});
