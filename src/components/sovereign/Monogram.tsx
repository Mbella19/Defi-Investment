import Image from "next/image";

type Props = {
  size?: number;
  inverted?: boolean;
};

export function Monogram({ size = 44, inverted = false }: Props) {
  return (
    <Image
      src="/sovereign-mark.png"
      alt=""
      width={size}
      height={size}
      style={{
        flexShrink: 0,
        display: "inline-block",
        height: size,
        objectFit: "contain",
        opacity: inverted ? 0.94 : 1,
        width: size,
      }}
      aria-hidden="true"
    />
  );
}

export default Monogram;
