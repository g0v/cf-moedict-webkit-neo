export class Resvg {
  // svg input is intentionally unused: in tests we never produce a real PNG.
  constructor(public svg: string) {}
  render() {
    return { asPng: () => new Uint8Array([137, 80, 78, 71]) }; // minimal PNG magic
  }
}
