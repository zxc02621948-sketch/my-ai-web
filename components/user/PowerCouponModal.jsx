// components/user/PowerCouponModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function PowerCouponModal({ isOpen, onClose, userData }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingCoupon, setUsingCoupon] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    loadCoupons();
  }, [isOpen]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/power-coupon/user-coupons', {
        withCredentials: true
      });
      if (res?.data?.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (error) {
      console.error('載入權力券失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const useCoupon = async (couponId, imageId) => {
    try {
      setUsingCoupon(couponId);
      const res = await axios.post('/api/power-coupon/use', {
        couponId,
        imageId
      }, {
        withCredentials: true
      });
      
      if (res?.data?.success) {
        alert('權力券使用成功！');
        loadCoupons(); // 重新載入權力券
      } else {
        alert(res?.data?.message || '使用失敗');
      }
    } catch (error) {
      console.error('使用權力券失敗:', error);
      alert('使用失敗，請稍後再試');
    } finally {
      setUsingCoupon(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">我的權力券</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400">載入中...</p>
        ) : coupons.length === 0 ? (
          <p className="text-gray-400">尚無權力券</p>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <div key={coupon._id} className="bg-zinc-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {coupon.type === '7day' ? '7天券' : 
                       coupon.type === '30day' ? '30天券' : 
                       coupon.type === 'rare' ? '稀有券' : coupon.type}
                    </h3>
                    <p className="text-sm text-gray-400">
                      購買時間: {new Date(coupon.createdAt).toLocaleString()}
                    </p>
                    {coupon.expiry && (
                      <p className="text-sm text-gray-400">
                        過期時間: {new Date(coupon.expiry).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-semibold">
                      {coupon.purchasePrice} 積分
                    </p>
                    <button
                      onClick={() => {
                        const imageId = prompt('請輸入要使用權力券的圖片ID:');
                        if (imageId) {
                          useCoupon(coupon._id, imageId);
                        }
                      }}
                      disabled={usingCoupon === coupon._id}
                      className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {usingCoupon === coupon._id ? '使用中...' : '使用'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


