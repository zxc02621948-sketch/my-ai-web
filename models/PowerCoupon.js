// models/PowerCoupon.js
import mongoose from "mongoose";

const PowerCouponSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { 
      type: String, 
      enum: ['7day', '30day', 'rare'], 
      required: true 
    },
    quantity: { type: Number, default: 1 },
    expiry: { type: Date, default: null }, // null for rare coupons (no expiry)
    used: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    usedOnImage: { type: mongoose.Schema.Types.ObjectId, ref: "Image", default: null }, // 保留向后兼容
    usedOnContentId: { type: mongoose.Schema.Types.ObjectId, default: null }, // 通用内容ID
    contentType: { type: String, enum: ['image', 'video', 'music'], default: null }, // 内容类型
    
    // 購買記錄
    purchasePrice: { type: Number, default: 0 },
    purchaseMethod: { 
      type: String, 
      enum: ['shop', 'gacha', 'reward'], 
      default: 'shop' 
    },
    
    // 稀有券特殊屬性
    isRare: { type: Boolean, default: false },
    gachaId: { type: mongoose.Schema.Types.ObjectId, ref: "Gacha", default: null },
  },
  {
    timestamps: true
  }
);

// 索引
PowerCouponSchema.index({ userId: 1, used: 1 });
PowerCouponSchema.index({ type: 1, used: 1 });
PowerCouponSchema.index({ expiry: 1 });

export default mongoose.models.PowerCoupon || mongoose.model("PowerCoupon", PowerCouponSchema);


