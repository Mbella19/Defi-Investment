import Image from "next/image";

export const socialIconMap = {
  discord: { src: "/social/discord.svg", label: "Discord" },
  docs: { src: "/social/docs.svg", label: "Docs" },
  twitter: { src: "/social/twitter.svg", label: "Twitter" },
  github: { src: "/social/github.svg", label: "GitHub" },
} as const;

export type SocialIconId = keyof typeof socialIconMap;

export function SocialIcon({
  id,
  size = 24,
  className = "social-icon",
}: {
  id: SocialIconId;
  size?: number;
  className?: string;
}) {
  const icon = socialIconMap[id];

  return (
    <Image
      className={className}
      src={icon.src}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
    />
  );
}
