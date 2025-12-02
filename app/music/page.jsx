// app/music/page.jsx - 服務端包裝器，讓 /music 正常渲染 ClientMusicPage
import ClientMusicPage from "./ClientMusicPage";

export const dynamic = "force-dynamic";

export default function MusicPage() {
  return <ClientMusicPage />;
}


