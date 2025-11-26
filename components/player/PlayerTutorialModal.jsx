"use client";

import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";

export default function PlayerTutorialModal({ isOpen, onClose }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 text-left align-middle shadow-xl transition-all border border-gray-700">
                <div className="relative">
                  {/* 標題欄 */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-bold text-white"
                    >
                      🎵 播放器使用教學
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* 內容區域 */}
                  <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* 基本操作 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>🎮</span> 基本操作
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="text-blue-400 font-semibold min-w-[80px]">點擊播放器</span>
                          <span>展開/收合播放器，查看完整控制面板</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-blue-400 font-semibold min-w-[80px]">拖動播放器</span>
                          <span>按住播放器任意位置，可以自由移動到螢幕上的任何位置</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-blue-400 font-semibold min-w-[80px]">點擊曲名</span>
                          <span>點擊頂部的曲名跑馬燈，可以打開當前播放音樂的詳細頁面</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-blue-400 font-semibold min-w-[80px]">進度條</span>
                          <span>點擊或拖動底部的進度條，可以跳轉到音樂的任意位置</span>
                        </div>
                      </div>
                    </section>

                    {/* 播放控制 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>🎛️</span> 播放控制
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="text-purple-400 font-semibold min-w-[100px]">播放/暫停</span>
                          <span>點擊播放器中央的播放按鈕，開始或暫停音樂播放</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-purple-400 font-semibold min-w-[100px]">上一首/下一首</span>
                          <span>在展開的播放器中，使用左右箭頭按鈕切換歌曲</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-purple-400 font-semibold min-w-[100px]">隨機播放</span>
                          <span>點擊右上角的隨機播放按鈕（↻），啟用或關閉隨機播放模式</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-purple-400 font-semibold min-w-[100px]">音量控制</span>
                          <span>在展開的播放器中，使用音量滑桿調整播放音量</span>
                        </div>
                      </div>
                    </section>

                    {/* 釘選功能 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>📌</span> 釘選播放器
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <p>
                          釘選功能讓你可以將喜歡的播放清單固定在螢幕上，無論瀏覽哪個頁面都能持續播放。
                        </p>
                        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="text-yellow-400 font-semibold min-w-[100px]">如何釘選</span>
                            <span>在用戶的播放器頁面，點擊左上角的釘選按鈕（📌），即可將該播放清單釘選到全域</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-yellow-400 font-semibold min-w-[100px]">釘選後</span>
                            <span>播放器會顯示在螢幕上，並顯示釘選狀態提示（包含用戶名和剩餘天數）</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-yellow-400 font-semibold min-w-[100px]">解除釘選</span>
                            <span>點擊釘選狀態提示右側的 ✕ 按鈕，即可解除釘選</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 播放器頁面與編輯歌單 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>📝</span> 播放器頁面與編輯歌單
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <p>
                          想要編輯自己的播放清單嗎？你需要先找到播放器頁面。
                        </p>
                        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="text-green-400 font-semibold min-w-[100px]">如何找到</span>
                            <span>點擊右上角的頭像或個人資料，進入你的個人頁面，然後在個人頁面中找到「🎧 播放器」按鈕並點擊，即可進入播放器頁面</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-green-400 font-semibold min-w-[100px]">編輯歌單</span>
                            <span>在播放器頁面中，點擊「編輯歌單」或「管理歌單」按鈕，即可新增、刪除或重新排序歌曲</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-green-400 font-semibold min-w-[100px]">新增歌曲</span>
                            <span>在音樂頁面點擊喜歡的音樂，然後點擊「加入播放清單」按鈕，即可將音樂加入你的播放清單</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-green-400 font-semibold min-w-[100px]">快速訪問</span>
                            <span>編輯完成後，你可以將播放器釘選到全域，這樣就能在任何頁面使用你的播放清單了</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 播放器造型 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>🎨</span> 播放器造型
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <p>
                          你可以選擇不同的播放器造型，讓播放器更符合你的風格。
                        </p>
                        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="text-pink-400 font-semibold min-w-[100px]">預設造型</span>
                            <span>簡約的圓形播放器，適合所有使用者</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-pink-400 font-semibold min-w-[100px]">貓咪耳機</span>
                            <span>可愛的動畫貓咪耳機造型，播放時會有音符動畫效果</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-pink-400 font-semibold min-w-[100px]">自訂顏色</span>
                            <span>部分造型支援自訂顏色，可以在播放器設定中調整</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 提示 */}
                    <section>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span>💡</span> 使用提示
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>播放器會記住你的位置和展開狀態，下次使用時會自動恢復</li>
                          <li>釘選的播放器可以在任何頁面使用，不受頁面切換影響</li>
                          <li>釘選播放器支援背景播放，即使切換到其他頁面也能繼續播放</li>
                          <li>如果遇到播放問題，可以嘗試重新整理頁面或解除釘選後重新釘選</li>
                        </ul>
                      </div>
                    </section>
                  </div>

                  {/* 底部按鈕 */}
                  <div className="flex justify-end p-6 border-t border-gray-700">
                    <button
                      onClick={onClose}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      我知道了
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

