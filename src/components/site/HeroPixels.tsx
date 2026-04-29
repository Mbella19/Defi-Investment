type Pixel = {
  x: string;
  y: string;
  size: number;
  color: string;
  kind: "square" | "plus";
};

const pixels: Pixel[] = [
  { kind: "square", x: "4%", y: "6%", size: 8, color: "#1683ff" },
  { kind: "square", x: "10%", y: "12%", size: 7, color: "#f9c74f" },
  { kind: "square", x: "16%", y: "4%", size: 9, color: "#ff595e" },
  { kind: "square", x: "22%", y: "16%", size: 7, color: "#56e08a" },
  { kind: "square", x: "28%", y: "7%", size: 8, color: "#f9c74f" },
  { kind: "plus", x: "32%", y: "20%", size: 16, color: "#3f83ff" },
  { kind: "square", x: "37%", y: "10%", size: 7, color: "#ff595e" },
  { kind: "square", x: "42%", y: "4%", size: 8, color: "#1683ff" },
  { kind: "square", x: "46%", y: "14%", size: 7, color: "#f9c74f" },
  { kind: "square", x: "51%", y: "5%", size: 9, color: "#56e08a" },
  { kind: "square", x: "55%", y: "16%", size: 7, color: "#ff8a3d" },
  { kind: "square", x: "59%", y: "8%", size: 8, color: "#1683ff" },
  { kind: "square", x: "63%", y: "20%", size: 7, color: "#f9c74f" },
  { kind: "square", x: "67%", y: "4%", size: 9, color: "#ff595e" },
  { kind: "square", x: "71%", y: "14%", size: 7, color: "#56e08a" },
  { kind: "square", x: "75%", y: "8%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "80%", y: "18%", size: 7, color: "#1683ff" },
  { kind: "square", x: "84%", y: "5%", size: 9, color: "#ff595e" },
  { kind: "square", x: "89%", y: "13%", size: 7, color: "#56e08a" },
  { kind: "square", x: "94%", y: "20%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "3%", y: "28%", size: 7, color: "#56e08a" },
  { kind: "square", x: "9%", y: "34%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "15%", y: "25%", size: 7, color: "#ff595e" },
  { kind: "plus", x: "22%", y: "32%", size: 14, color: "#1683ff" },
  { kind: "square", x: "29%", y: "26%", size: 7, color: "#f9c74f" },
  { kind: "square", x: "35%", y: "34%", size: 8, color: "#56e08a" },
  { kind: "square", x: "41%", y: "28%", size: 7, color: "#ff595e" },
  { kind: "square", x: "47%", y: "32%", size: 6, color: "#f9c74f" },
  { kind: "square", x: "53%", y: "26%", size: 7, color: "#1683ff" },
  { kind: "square", x: "58%", y: "32%", size: 8, color: "#56e08a" },
  { kind: "square", x: "63%", y: "28%", size: 7, color: "#f9c74f" },
  { kind: "square", x: "68%", y: "34%", size: 6, color: "#ff8a3d" },
  { kind: "plus", x: "74%", y: "26%", size: 14, color: "#3f83ff" },
  { kind: "square", x: "82%", y: "32%", size: 7, color: "#ff595e" },
  { kind: "square", x: "88%", y: "26%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "93%", y: "32%", size: 7, color: "#56e08a" },
  { kind: "square", x: "97%", y: "38%", size: 6, color: "#ff595e" },
  { kind: "square", x: "5%", y: "44%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "12%", y: "50%", size: 7, color: "#1683ff" },
  { kind: "square", x: "20%", y: "46%", size: 6, color: "#56e08a" },
  { kind: "square", x: "27%", y: "52%", size: 8, color: "#ff595e" },
  { kind: "square", x: "34%", y: "48%", size: 6, color: "#f9c74f" },
  { kind: "square", x: "40%", y: "54%", size: 7, color: "#56e08a" },
  { kind: "square", x: "46%", y: "44%", size: 7, color: "#ff595e" },
  { kind: "square", x: "53%", y: "48%", size: 6, color: "#f9c74f" },
  { kind: "square", x: "85%", y: "42%", size: 7, color: "#1683ff" },
  { kind: "square", x: "91%", y: "48%", size: 6, color: "#ff595e" },
  { kind: "square", x: "96%", y: "54%", size: 8, color: "#f9c74f" },
  { kind: "square", x: "3%", y: "60%", size: 7, color: "#56e08a" },
  { kind: "square", x: "10%", y: "66%", size: 6, color: "#f9c74f" },
  { kind: "square", x: "17%", y: "62%", size: 8, color: "#ff595e" },
  { kind: "square", x: "25%", y: "68%", size: 6, color: "#1683ff" },
  { kind: "square", x: "32%", y: "62%", size: 7, color: "#56e08a" },
  { kind: "square", x: "39%", y: "68%", size: 6, color: "#f9c74f" },
  { kind: "square", x: "46%", y: "62%", size: 7, color: "#ff8a3d" },
  { kind: "square", x: "94%", y: "62%", size: 7, color: "#56e08a" },
  { kind: "square", x: "97%", y: "68%", size: 6, color: "#f9c74f" },
  { kind: "plus", x: "55%", y: "8%", size: 14, color: "#3f83ff" },
  { kind: "plus", x: "88%", y: "26%", size: 14, color: "#3f83ff" },
  { kind: "plus", x: "82%", y: "48%", size: 12, color: "#3f83ff" },
];

export function HeroPixels() {
  return (
    <div className="hero-pixels" aria-hidden="true">
      {pixels.map((pixel, index) => (
        <span
          key={index}
          data-kind={pixel.kind}
          style={{
            left: pixel.x,
            top: pixel.y,
            width: pixel.size,
            height: pixel.size,
            color: pixel.color,
            background: pixel.kind === "square" ? pixel.color : undefined,
          }}
        />
      ))}
    </div>
  );
}
