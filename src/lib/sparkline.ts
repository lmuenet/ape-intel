// Maps a number series to an SVG polyline `points` string. Y is inverted
// (SVG origin is top-left) so larger values sit higher. A flat series renders
// on the mid-line.
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
