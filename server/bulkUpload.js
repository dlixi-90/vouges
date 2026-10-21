import mongoose from "mongoose";
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import Product from "./models/Product.js";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Your dummyProducts array (update images to file names Like "product_1.png")
const dummyProducts = [
  {
    title: "Dầu dưỡng tóc argan",
    images: ["product_1.png"],
    price: { "50ml": 15, "100ml": 25, "200ml": 40 },
    description:
      "Dầu dưỡng tóc argan giàu vitamin giúp nuôi dưỡng mái tóc khỏe mạnh, óng mượt. Kết cấu nhẹ thẩm thấu nhanh, không để lại cảm giác nhờn rít.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng thể dừa",
    images: ["product_2.png", "product_28.png", "product_29.png"],
    price: { "100ml": 20, "200ml": 35, "400ml": 50 },
    description:
      "Dầu dưỡng thể dừa cấp ẩm sâu cho da, mang hương thơm nhiệt đới dễ chịu. Sản phẩm giúp cải thiện độ đàn hồi và giữ da mềm mại suốt ngày dài.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Dầu dưỡng da mặt jojoba",
    images: ["product_3.png"],
    price: { "30ml": 25, "50ml": 40, "100ml": 60 },
    description:
      "Dầu dưỡng da mặt jojoba có đặc tính tương đồng với dầu tự nhiên trên da, phù hợp với mọi loại da. Sản phẩm giúp cân bằng lượng dầu và bổ sung độ ẩm cần thiết.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng tóc tràm trà",
    images: ["product_4.png"],
    price: { "50ml": 18, "100ml": 30, "200ml": 45 },
    description:
      "Dầu dưỡng tóc tràm trà giúp làm sạch da đầu, giảm gàu và hỗ trợ tóc phát triển. Đặc tính kháng khuẩn giúp duy trì da đầu sạch, khỏe.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Dầu dưỡng thể hạnh nhân",
    images: ["product_5.png"],
    price: { "100ml": 22, "200ml": 38, "400ml": 55 },
    description:
      "Dầu dưỡng thể hạnh nhân bổ sung vitamin E, giúp nuôi dưỡng và làm mềm da. Công thức dịu nhẹ phù hợp với da nhạy cảm, giúp cải thiện bề mặt da.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng da mặt tầm xuân",
    images: ["product_6.png"],
    price: { "30ml": 28, "50ml": 45, "100ml": 65 },
    description:
      "Dầu dưỡng da mặt tầm xuân giàu chất chống oxy hóa giúp làn da tươi sáng hơn. Sản phẩm hỗ trợ làm mờ các nếp nhăn nhỏ và sẹo.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng tóc thầu dầu",
    images: ["product_7.png"],
    price: { "50ml": 12, "100ml": 20, "200ml": 35 },
    description:
      "Dầu dưỡng tóc thầu dầu giúp tóc chắc khỏe, dày và bóng mượt hơn. Công thức giàu dưỡng chất hỗ trợ ngăn ngừa tóc chẻ ngọn, gãy rụng.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng thể oải hương",
    images: ["product_8.png"],
    price: { "100ml": 25, "200ml": 40, "400ml": 60 },
    description:
      "Dầu dưỡng thể oải hương mang hương thơm dịu nhẹ, giúp thư giãn cơ thể. Sản phẩm phù hợp sử dụng vào buổi tối để tạo cảm giác thư thái và hỗ trợ giấc ngủ.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu dưỡng da mặt vitamin C",
    images: ["product_9.png"],
    price: { "30ml": 30, "50ml": 50, "100ml": 75 },
    description:
      "Dầu dưỡng da mặt vitamin C giúp làm sáng da, giảm đốm thâm và cải thiện sắc da không đều. Công thức giàu chất chống oxy hóa hỗ trợ bảo vệ da trước tác động từ môi trường.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Nước hoa hương cam chanh",
    images: ["product_10.png"],
    price: { "50ml": 40, "100ml": 60, "200ml": 85 },
    description:
      "Nước hoa hương cam chanh đánh thức các giác quan với nốt hương chanh và cam tươi mát. Hương thơm đầy sức sống lưu lại suốt ngày dài.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương hoa dịu dàng",
    images: ["product_11.png"],
    price: { "50ml": 45, "100ml": 65, "200ml": 90 },
    description:
      "Nước hoa hương hoa dịu dàng kết hợp tinh chất hoa hồng và hoa nhài, mang đến nét thanh lịch. Hương thơm vượt thời gian, phù hợp cho những dịp đặc biệt.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương gỗ ấm",
    images: ["product_12.png"],
    price: { "50ml": 35, "100ml": 55, "200ml": 80 },
    description:
      "Nước hoa hương gỗ ấm kết hợp gỗ đàn hương và quế, tạo chiều sâu cuốn hút. Hương thơm ấm áp, trầm lắng, phù hợp sử dụng vào buổi tối.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương gió biển",
    images: ["product_13.png"],
    price: { "50ml": 42, "100ml": 62, "200ml": 88 },
    description:
      "Nước hoa hương gió biển mang đến cảm giác sảng khoái với nốt hương muối biển và nước mát. Hương thơm trong trẻo, phù hợp sử dụng hằng ngày.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Nước hoa hương vani và xạ hương",
    images: ["product_14.png"],
    price: { "50ml": 38, "100ml": 58, "200ml": 82 },
    description:
      "Nước hoa hương vani và xạ hương mang nét ngọt ngào, ấm áp đầy lôi cuốn. Hương thơm dễ chịu, phù hợp cho những buổi tối thư giãn.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương hổ phách nồng ấm",
    images: ["product_15.png"],
    price: { "50ml": 44, "100ml": 64, "200ml": 89 },
    description:
      "Nước hoa hương hổ phách nồng ấm kết hợp hổ phách đậm đà và các nốt hương gia vị cuốn hút. Hương thơm mạnh mẽ giúp bạn thể hiện dấu ấn riêng.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương bạc hà tươi mát",
    images: ["product_16.png"],
    price: { "50ml": 36, "100ml": 56, "200ml": 81 },
    description:
      "Nước hoa hương bạc hà tươi mát kết hợp bạc hà và trà xanh. Hương thơm sảng khoái mang đến khởi đầu buổi sáng đầy năng lượng.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương trầm quyến rũ",
    images: ["product_17.png"],
    price: { "50ml": 48, "100ml": 70, "200ml": 95 },
    description:
      "Nước hoa hương trầm quyến rũ mang nốt hương trầm hương và nhang thơm đậm đà. Hương thơm sang trọng giúp bạn để lại ấn tượng khó quên.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước hoa hương quả mọng",
    images: ["product_18.png"],
    price: { "50ml": 39, "100ml": 59, "200ml": 84 },
    description:
      "Nước hoa hương quả mọng kết hợp nét ngọt dịu của trái cây và thoang thoảng hương hoa. Hương thơm tươi vui, phù hợp cho những hoạt động ban ngày.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Tinh chất cấp ẩm axit hyaluronic",
    images: ["product_19.png"],
    price: { "30ml": 25, "50ml": 40, "100ml": 60 },
    description:
      "Tinh chất axit hyaluronic cấp ẩm sâu và giữ ẩm, giúp da căng mọng. Kết cấu nhẹ phù hợp với mọi loại da.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Tinh chất làm sáng da vitamin C",
    images: ["product_20.png"],
    price: { "30ml": 28, "50ml": 45, "100ml": 65 },
    description:
      "Tinh chất vitamin C giúp làm sáng da và giảm đốm thâm. Khả năng chống oxy hóa giúp cải thiện làn da xỉn màu.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Tinh chất retinol chống lão hóa",
    images: ["product_21.png"],
    price: { "30ml": 30, "50ml": 50, "100ml": 70 },
    description:
      "Tinh chất retinol chống lão hóa giúp làm mờ nếp nhăn, mang lại làn da trẻ trung hơn. Công thức hỗ trợ quá trình sản sinh collagen trong đêm.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Tinh chất niacinamide cân bằng da",
    images: ["product_22.png"],
    price: { "30ml": 22, "50ml": 35, "100ml": 55 },
    description:
      "Tinh chất niacinamide giúp kiểm soát dầu, cải thiện lỗ chân lông và bề mặt da. Sản phẩm đồng thời hỗ trợ làm dịu tình trạng viêm, mẩn đỏ.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Tinh chất peptide làm săn chắc da",
    images: ["product_23.png"],
    price: { "30ml": 32, "50ml": 52, "100ml": 75 },
    description:
      "Tinh chất peptide hỗ trợ sản sinh collagen, giúp da săn chắc hơn. Công thức chuyên biệt giúp phục hồi độ đàn hồi của da.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    popular: false,
    inStock: true,
  },
  {
    title: "Dầu gội tạo độ phồng",
    images: ["product_24.png"],
    price: { "200ml": 15, "400ml": 25, "750ml": 40 },
    description:
      "Dầu gội tạo độ phồng giúp mái tóc mảnh trông bồng bềnh hơn. Công thức làm sạch dịu nhẹ, đồng thời tạo độ phồng từ chân tóc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu gội dưỡng ẩm",
    images: ["product_25.png"],
    price: { "200ml": 18, "400ml": 30, "750ml": 45 },
    description:
      "Dầu gội dưỡng ẩm bổ sung dầu tự nhiên, giúp cấp ẩm cho tóc khô. Công thức giàu dưỡng chất giúp phục hồi độ ẩm cho mái tóc thiếu sức sống.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Dầu gội làm sạch sâu",
    images: ["product_26.png"],
    price: { "200ml": 20, "400ml": 35, "750ml": 50 },
    description:
      "Dầu gội làm sạch sâu giúp loại bỏ cặn tích tụ, mang lại mái tóc sạch thoáng. Sử dụng hằng tuần để chăm sóc da đầu và làm mới mái tóc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Dầu gội giảm gàu",
    images: ["product_27.png"],
    price: { "200ml": 16, "400ml": 28, "750ml": 42 },
    description:
      "Dầu gội giảm gàu giúp làm dịu da đầu. Công thức chuyên biệt hỗ trợ kiểm soát tình trạng ngứa và bong tróc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Dầu gội bảo vệ màu nhuộm",
    images: ["product_28.png"],
    price: { "200ml": 19, "400ml": 32, "750ml": 48 },
    description:
      "Dầu gội bảo vệ màu nhuộm giúp giữ màu tóc rực rỡ. Công thức không chứa sulfat giúp màu nhuộm bền lâu hơn.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Xịt thơm toàn thân hương cam chanh",
    images: ["product_29.png"],
    price: { "150ml": 12, "250ml": 20, "500ml": 35 },
    description:
      "Xịt thơm toàn thân hương cam chanh mang đến cảm giác tươi mát tức thì. Làn sương nhẹ với hương thơm sảng khoái giúp bạn lấy lại năng lượng trong ngày.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Xịt thơm toàn thân hương bạc hà",
    images: ["product_30.png"],
    price: { "150ml": 14, "250ml": 22, "500ml": 38 },
    description:
      "Xịt thơm toàn thân hương bạc hà mang lại cảm giác mát dịu, đầy sức sống. Công thức tươi mát đánh thức các giác quan và làm dịu làn da.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Xịt thơm toàn thân hương vani",
    images: ["product_31.png"],
    price: { "150ml": 13, "250ml": 21, "500ml": 36 },
    description:
      "Xịt thơm toàn thân hương vani mang đến nét ngọt ngào, ấm áp cho ngày mới. Hương vani dịu nhẹ bao bọc cơ thể, tạo cảm giác thư thái.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Xịt thơm toàn thân hương sóng biển",
    images: ["product_32.png"],
    price: { "150ml": 15, "250ml": 25, "500ml": 40 },
    description:
      "Xịt thơm toàn thân hương sóng biển mang nốt hương nước mát trong trẻo. Mỗi lần xịt gợi cảm giác thư thái như đang tận hưởng kỳ nghỉ bên bờ biển.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Xịt thơm toàn thân hương quả mọng",
    images: ["product_33.png"],
    price: { "150ml": 11, "250ml": 18, "500ml": 32 },
    description:
      "Xịt thơm toàn thân hương quả mọng mang hương trái cây ngọt ngào, tươi vui. Sự kết hợp của nhiều loại quả mọng tạo nên trải nghiệm hương thơm thú vị.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa rửa mặt tạo bọt dịu nhẹ",
    images: ["product_34.png"],
    price: { "100ml": 15, "200ml": 25, "400ml": 40 },
    description:
      "Sữa rửa mặt tạo bọt dịu nhẹ phù hợp với da nhạy cảm. Công thức cân bằng độ pH giúp loại bỏ bụi bẩn mà vẫn giữ lớp dầu tự nhiên trên da.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa rửa mặt kiểm soát dầu",
    images: ["product_35.png"],
    price: { "100ml": 18, "200ml": 30, "400ml": 45 },
    description:
      "Sữa rửa mặt kiểm soát dầu giúp giảm bã nhờn dư thừa. Công thức làm sạch sâu hỗ trợ hạn chế bóng dầu suốt ngày dài.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa rửa mặt dưỡng ẩm",
    images: ["product_36.png"],
    price: { "100ml": 20, "200ml": 35, "400ml": 50 },
    description:
      "Sữa rửa mặt dưỡng ẩm có kết cấu dạng sữa, giúp làm sạch đồng thời nuôi dưỡng da. Công thức dịu nhẹ phù hợp với da khô hoặc thiếu nước.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Gel rửa mặt tẩy tế bào chết",
    images: ["product_37.png"],
    price: { "100ml": 22, "200ml": 38, "400ml": 55 },
    description:
      "Gel rửa mặt tẩy tế bào chết nhẹ nhàng loại bỏ lớp tế bào già cỗi. Công thức dùng hằng ngày giúp da sáng, mịn hơn mà không gây kích ứng.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước tẩy trang micellar",
    images: ["product_38.png"],
    price: { "100ml": 16, "200ml": 28, "400ml": 42 },
    description:
      "Nước tẩy trang micellar giúp loại bỏ lớp trang điểm dễ dàng mà không cần rửa lại. Sản phẩm kết hợp làm sạch, cân bằng và làm tươi mát da trong một bước.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước rửa tay kháng khuẩn",
    images: ["product_39.png"],
    price: { "250ml": 10, "500ml": 18, "1000ml": 30 },
    description:
      "Nước rửa tay kháng khuẩn giúp làm sạch và bảo vệ đôi tay một cách dịu nhẹ. Công thức loại bỏ 99,9% vi khuẩn mà không làm khô da tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước rửa tay dưỡng ẩm",
    images: ["product_40.png"],
    price: { "250ml": 12, "500ml": 20, "1000ml": 35 },
    description:
      "Nước rửa tay dưỡng ẩm bổ sung nha đam giúp chăm sóc đôi tay. Công thức làm sạch đồng thời duy trì hàng rào giữ ẩm tự nhiên của da.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước rửa tay hương cam chanh",
    images: ["product_41.png"],
    price: { "250ml": 11, "500ml": 19, "1000ml": 32 },
    description:
      "Nước rửa tay hương cam chanh mang đến cảm giác tươi mát, sảng khoái. Đôi tay được làm sạch và lưu lại hương cam chanh dễ chịu.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước rửa tay hương oải hương",
    images: ["product_42.png"],
    price: { "250ml": 13, "500ml": 22, "1000ml": 38 },
    description:
      "Nước rửa tay hương oải hương có công thức dịu nhẹ, giúp làm dịu da. Tinh dầu oải hương mang đến cảm giác thư giãn mỗi khi rửa tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Nước rửa tay tràm trà",
    images: ["product_43.png"],
    price: { "250ml": 14, "500ml": 24, "1000ml": 40 },
    description:
      "Nước rửa tay tràm trà giúp làm sạch hiệu quả với thành phần tự nhiên. Đặc tính kháng khuẩn của dầu tràm trà hỗ trợ làm sạch đôi tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Son lì màu đỏ",
    images: ["product_44.png"],
    price: { "3g": 15, "5g": 25 },
    description:
      "Son lì màu đỏ mang đến đôi môi nổi bật với sắc son bền màu, mịn như nhung. Công thức giàu sắc tố cho độ che phủ cao mà vẫn dễ chịu khi sử dụng.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["3g", "5g"],

    popular: false,
    inStock: true,
  },
  {
    title: "Son dưỡng ẩm",
    images: ["product_45.png"],
    price: { "4g": 10, "8g": 18 },
    description:
      "Son dưỡng ẩm bổ sung bơ hạt mỡ giúp đôi môi mềm mại. Công thức giàu dưỡng chất làm dịu tức thì tình trạng môi khô, nứt nẻ.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["4g", "8g"],

    popular: false,
    inStock: true,
  },
  {
    title: "Son bóng màu hồng",
    images: ["product_46.png"],
    price: { "5ml": 12, "10ml": 20 },
    description:
      "Son bóng màu hồng giúp đôi môi căng mọng, rạng rỡ mà không gây bết dính. Lớp son bóng nổi bật kết hợp sắc hồng nhẹ nhàng, tự nhiên.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["5ml", "10ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Tinh chất dưỡng môi vitamin E",
    images: ["product_47.png"],
    price: { "10ml": 18, "20ml": 30 },
    description:
      "Tinh chất dưỡng môi vitamin E giúp phục hồi và nuôi dưỡng đôi môi mịn màng. Công thức chăm sóc chuyên sâu hỗ trợ lấy lại độ mềm mại, đàn hồi cho môi.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["10ml", "20ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Son lì màu da",
    images: ["product_48.png"],
    price: { "3g": 14, "5g": 24 },
    description:
      "Son lì màu da mang đến vẻ đẹp tự nhiên, phù hợp sử dụng hằng ngày. Sắc son dễ phối, hài hòa với mọi tông da và có lớp màu lì thanh lịch.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["3g", "5g"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa dưỡng thể nha đam",
    images: ["product_49.png"],
    price: { "200ml": 15, "400ml": 25, "750ml": 40 },
    description:
      "Sữa dưỡng thể nha đam giúp làm dịu, làm mát và cấp ẩm cho da. Kết cấu nhẹ thẩm thấu nhanh, làm dịu tức thì làn da khô.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],

    popular: true,
    inStock: true,
  },
  {
    title: "Kem dưỡng tay bơ hạt mỡ",
    images: ["product_50.png"],
    price: { "100ml": 12, "200ml": 20, "400ml": 35 },
    description:
      "Kem dưỡng tay bơ hạt mỡ có kết cấu giàu dưỡng chất, giúp nuôi dưỡng da tay. Công thức chuyên sâu duy trì độ ẩm lâu dài cho đôi tay thường xuyên hoạt động.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa dưỡng thể dừa cấp ẩm",
    images: ["product_51.png"],
    price: { "200ml": 18, "400ml": 30, "750ml": 45 },
    description:
      "Sữa dưỡng thể dừa cấp ẩm sâu cho da với kết cấu nhẹ và hương thơm nhiệt đới.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa dưỡng thể oải hương thư giãn",
    images: ["product_52.png"],
    price: { "100ml": 14, "200ml": 22, "400ml": 38 },
    description:
      "Sữa dưỡng thể oải hương có hương thơm dịu nhẹ, giúp làm dịu da và mang lại cảm giác thư giãn.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa dưỡng thể bổ sung vitamin E",
    images: ["product_53.png"],
    price: { "200ml": 20, "400ml": 35, "750ml": 50 },
    description:
      "Sữa dưỡng thể bổ sung vitamin E giàu chất chống oxy hóa, giúp bảo vệ và phục hồi da.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],

    popular: false,
    inStock: true,
  },
  {
    title: "Sữa dưỡng thể không mùi cho da nhạy cảm",
    images: ["product_54.png"],
    price: { "100ml": 16, "200ml": 28, "400ml": 42 },
    description:
      "Sữa dưỡng thể không mùi mang đến sự chăm sóc dịu nhẹ cho làn da nhạy cảm.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],

    popular: false,
    inStock: true,
  },
];

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLDN_NAME,
  api_key: process.env.CLDN_API_KEY,
  api_secret: process.env.CLDN_API_SECRET,
});

async function bulkUpload() {
  try {
    // Connect to MongoDB
    await mongoose.connect(`${process.env.MONGO_URI}`); // Or your full URI

    for (const prod of dummyProducts) {
      // Upload images to CLoudinary
      const imagesUrl = await Promise.all(
        prod.images.map(async (fileName) => {
          const filePath = path.join(__dirname, "images", fileName);
          const result = await cloudinary.uploader.upload(filePath, {
            resource_type: "image",
          });
          return result.secure_url;
        }),
      );

      // Create product in DB
      await Product.create({
        title: prod.title,
        description: prod.description,
        price: prod.price,
        sizes: prod.sizes,
        images: imagesUrl,
        category: prod.category,
        type: prod.type,
        popular: prod.popular,
        inStock: prod.inStock,
      });
      console.log(`Uploaded: ${prod.title}`);
    }
    console.log("All products uploaded successfully!");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    mongoose.disconnect();
  }
}
bulkUpload();
