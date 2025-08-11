// app/qa/page.jsx
import QAContent from "./QAContent";

export const metadata = {
  title: "Stable Diffusion 新手生成 Q&A",
  description:
    "常見問題：模型/LoRA 放哪裡、怎麼用、參數該怎麼調、Restart 取樣器、VAE、Hires 修復等。",
};

export default function Page() {
  return <QAContent />;
}
