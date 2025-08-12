import Link from "next/link";

export default function AvatarFrame({
  src,
  size = 48,
  alt = "User Avatar",
  onClick,
  className = "",
  ring = true,
  ringFrom = "#79FFE1",
  ringVia = "#A78BFA",
  ringTo = "#FF80BF",
  status,
  userId, // 使用者 ID 或 username
}) {
  const fallback =
    "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

  const clickable = !!userId || !!onClick; // 判斷是否可點

  const avatar = (
    <div
      onClick={onClick}
      className={`relative shrink-0 ${clickable ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size }}
      role={clickable ? "button" : undefined}
    >
      <div
        className={`rounded-full ${ring ? "p-[2px]" : ""}`}
        style={
          ring
            ? {
                backgroundImage: `linear-gradient(135deg, ${ringFrom}, ${ringVia}, ${ringTo})`,
                width: "100%",
                height: "100%",
              }
            : { width: "100%", height: "100%" }
        }
      >
        <div className="w-full h-full rounded-full bg-black p-[2px]">
          <img
            src={src || fallback}
            alt={alt}
            className="w-full h-full rounded-full object-cover shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
            draggable={false}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallback;
            }}
          />
        </div>
      </div>

      {status && (
        <span
          aria-label={status === "online" ? "online" : "offline"}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-black ${
            status === "online" ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
      )}
    </div>
  );

  return userId ? (
    <Link href={`/user/${userId}`} passHref>
      {avatar}
    </Link>
  ) : (
    avatar
  );
}
