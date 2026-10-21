import logoImg from "./logo.png";
import search from "./search.svg";
import user from "./user.svg";
import menu from "./menu.svg";
import menuClose from "./menu-close.svg";
import cartAdd from "./cart-add.svg";
import cartRemove from "./cart-remove.svg";
import cartAdded from "./cart-added.svg";
import forward from "./forward.svg";
import badge from "./badge.svg";
import heartAdd from "./heart-add.svg";
import returnRequest from "./return-request.svg";
import delivery from "./delivery.svg";
import secure from "./secure.svg";
import right from "./right.svg";
import pin from "./pin.svg";
import star from "./star.svg";
import facebook from "./facebook.svg";
import instagram from "./instagram.svg";
import twitter from "./twitter.svg";
import linkedin from "./linkedin.svg";
import rocket from "./rocket.svg";
import mail from "./mail.svg";
import phone from "./phone.svg";
import house from "./house.svg";
import graph from "./graph.svg";
import dollar from "./dollar.svg";
import map from "./map.svg";
import list from "./list.svg";
import dashboard from "./dashboard.svg";
import plus from "./plus.svg";
import squarePlus from "./square-plus.svg";
import minus from "./minus.svg";
import trash from "./trash.svg";
import hero from "./hero.webp";
import features1 from "../assets/features1.webp";
import features2 from "../assets/features2.webp";
import userImg from "./user.png";
import user1 from "./user1.png";
import user2 from "./user2.png";
import user3 from "./user3.png";
import user4 from "./user4.png";
import uploadIcon from "../assets/upload_icon.png";
// Products
import product_1 from "./product_1.png";
import product_2_1 from "./product_2.png";
import product_2_2 from "./product_3.png";
import product_2_3 from "./product_4.png";
import product_2_4 from "./product_5.png";
import product_3 from "./product_3.png";
import product_4 from "./product_4.png";
import product_5 from "./product_5.png";
import product_6 from "./product_6.png";
import product_7 from "./product_7.png";
import product_8 from "./product_8.png";
import product_9 from "./product_9.png";
import product_10 from "./product_10.png";
import product_11 from "./product_11.png";
import product_12 from "./product_12.png";
import product_13 from "./product_13.png";
import product_14 from "./product_14.png";
import product_15 from "./product_15.png";
import product_16 from "./product_16.png";
import product_17 from "./product_17.png";
import product_18 from "./product_18.png";
import product_19 from "./product_19.png";
import product_20 from "./product_20.png";
import product_21 from "./product_21.png";
import product_22 from "./product_22.png";
import product_23 from "./product_23.png";
import product_24 from "./product_24.png";
import product_25 from "./product_25.png";
import product_26 from "./product_26.png";
import product_27 from "./product_27.png";
import product_28 from "./product_28.png";
import product_29 from "./product_29.png";
import product_30 from "./product_30.png";
import product_31 from "./product_31.png";
import product_32 from "./product_32.png";
import product_33 from "./product_33.png";
import product_34 from "./product_34.png";
import product_35 from "./product_35.png";
import product_36 from "./product_36.png";
import product_37 from "./product_37.png";
import product_38 from "./product_38.png";
import product_39 from "./product_39.png";
import product_40 from "./product_40.png";
import product_41 from "./product_41.png";
import product_42 from "./product_42.png";
import product_43 from "./product_43.png";
import product_44 from "./product_44.png";
import product_45 from "./product_45.png";
import product_46 from "./product_46.png";
import product_47 from "./product_47.png";
import product_48 from "./product_48.png";
import product_49 from "./product_49.png";
import product_50 from "./product_50.png";
import product_51 from "./product_51.png";
import product_52 from "./product_52.png";
import product_53 from "./product_53.png";
import product_54 from "./product_54.png";
// Blogs
import blog1 from "./blogs/blog1.jpg";
import blog2 from "./blogs/blog2.jpg";
import blog3 from "./blogs/blog3.jpg";
import blog4 from "./blogs/blog4.jpg";
import blog5 from "./blogs/blog5.jpg";
import blog6 from "./blogs/blog6.jpg";
import blog7 from "./blogs/blog7.jpg";
import blog8 from "./blogs/blog8.jpg";

export const assets = {
  logoImg,
  search,
  user,
  menu,
  menuClose,
  cartAdd,
  cartRemove,
  cartAdded,
  forward,
  badge,
  heartAdd,
  returnRequest,
  delivery,
  secure,
  right,
  pin,
  star,
  facebook,
  instagram,
  twitter,
  linkedin,
  rocket,
  mail,
  phone,
  dollar,
  house,
  graph,
  map,
  dashboard,
  plus,
  minus,
  squarePlus,
  trash,
  list,
  userImg,
  user1,
  user2,
  user3,
  user4,
  hero,
  features1,
  features2,
  uploadIcon,
};


export const dummyProducts = [
  {
    _id: "1",
    title: "Dầu dưỡng tóc argan",
    images: [product_1],
    price: { "50ml": 15, "100ml": 25, "200ml": 40 },
    description:
      "Dầu dưỡng tóc argan giàu vitamin giúp nuôi dưỡng mái tóc khỏe mạnh, óng mượt. Kết cấu nhẹ thẩm thấu nhanh, không để lại cảm giác nhờn rít.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "2",
    title: "Dầu dưỡng thể dừa",
    images: [product_2_1, product_2_2, product_2_3, product_2_4],
    price: { "100ml": 20, "200ml": 35, "400ml": 50 },
    description:
      "Dầu dưỡng thể dừa cấp ẩm sâu cho da, mang hương thơm nhiệt đới dễ chịu. Sản phẩm giúp cải thiện độ đàn hồi và giữ da mềm mại suốt ngày dài.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "3",
    title: "Dầu dưỡng da mặt jojoba",
    images: [product_3],
    price: { "30ml": 25, "50ml": 40, "100ml": 60 },
    description:
      "Dầu dưỡng da mặt jojoba có đặc tính tương đồng với dầu tự nhiên trên da, phù hợp với mọi loại da. Sản phẩm giúp cân bằng lượng dầu và bổ sung độ ẩm cần thiết.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "4",
    title: "Dầu dưỡng tóc tràm trà",
    images: [product_4],
    price: { "50ml": 18, "100ml": 30, "200ml": 45 },
    description:
      "Dầu dưỡng tóc tràm trà giúp làm sạch da đầu, giảm gàu và hỗ trợ tóc phát triển. Đặc tính kháng khuẩn giúp duy trì da đầu sạch, khỏe.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "5",
    title: "Dầu dưỡng thể hạnh nhân",
    images: [product_5],
    price: { "100ml": 22, "200ml": 38, "400ml": 55 },
    description:
      "Dầu dưỡng thể hạnh nhân bổ sung vitamin E, giúp nuôi dưỡng và làm mềm da. Công thức dịu nhẹ phù hợp với da nhạy cảm, giúp cải thiện bề mặt da.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "6",
    title: "Dầu dưỡng da mặt tầm xuân",
    images: [product_6],
    price: { "30ml": 28, "50ml": 45, "100ml": 65 },
    description:
      "Dầu dưỡng da mặt tầm xuân giàu chất chống oxy hóa giúp làn da tươi sáng hơn. Sản phẩm hỗ trợ làm mờ các nếp nhăn nhỏ và sẹo.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "7",
    title: "Dầu dưỡng tóc thầu dầu",
    images: [product_7],
    price: { "50ml": 12, "100ml": 20, "200ml": 35 },
    description:
      "Dầu dưỡng tóc thầu dầu giúp tóc chắc khỏe, dày và bóng mượt hơn. Công thức giàu dưỡng chất hỗ trợ ngăn ngừa tóc chẻ ngọn, gãy rụng.",
    category: "Hair Care",
    type: "Oil",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "8",
    title: "Dầu dưỡng thể oải hương",
    images: [product_8],
    price: { "100ml": 25, "200ml": 40, "400ml": 60 },
    description:
      "Dầu dưỡng thể oải hương mang hương thơm dịu nhẹ, giúp thư giãn cơ thể. Sản phẩm phù hợp sử dụng vào buổi tối để tạo cảm giác thư thái và hỗ trợ giấc ngủ.",
    category: "Body Care",
    type: "Oil",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "9",
    title: "Dầu dưỡng da mặt vitamin C",
    images: [product_9],
    price: { "30ml": 30, "50ml": 50, "100ml": 75 },
    description:
      "Dầu dưỡng da mặt vitamin C giúp làm sáng da, giảm đốm thâm và cải thiện sắc da không đều. Công thức giàu chất chống oxy hóa hỗ trợ bảo vệ da trước tác động từ môi trường.",
    category: "Face Care",
    type: "Oil",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "10",
    title: "Nước hoa hương cam chanh",
    images: [product_10],
    price: { "50ml": 40, "100ml": 60, "200ml": 85 },
    description:
      "Nước hoa hương cam chanh đánh thức các giác quan với nốt hương chanh và cam tươi mát. Hương thơm đầy sức sống lưu lại suốt ngày dài.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "11",
    title: "Nước hoa hương hoa dịu dàng",
    images: [product_11],
    price: { "50ml": 45, "100ml": 65, "200ml": 90 },
    description:
      "Nước hoa hương hoa dịu dàng kết hợp tinh chất hoa hồng và hoa nhài, mang đến nét thanh lịch. Hương thơm vượt thời gian, phù hợp cho những dịp đặc biệt.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "12",
    title: "Nước hoa hương gỗ ấm",
    images: [product_12],
    price: { "50ml": 35, "100ml": 55, "200ml": 80 },
    description:
      "Nước hoa hương gỗ ấm kết hợp gỗ đàn hương và quế, tạo chiều sâu cuốn hút. Hương thơm ấm áp, trầm lắng, phù hợp sử dụng vào buổi tối.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "13",
    title: "Nước hoa hương gió biển",
    images: [product_13],
    price: { "50ml": 42, "100ml": 62, "200ml": 88 },
    description:
      "Nước hoa hương gió biển mang đến cảm giác sảng khoái với nốt hương muối biển và nước mát. Hương thơm trong trẻo, phù hợp sử dụng hằng ngày.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "14",
    title: "Nước hoa hương vani và xạ hương",
    images: [product_14],
    price: { "50ml": 38, "100ml": 58, "200ml": 82 },
    description:
      "Nước hoa hương vani và xạ hương mang nét ngọt ngào, ấm áp đầy lôi cuốn. Hương thơm dễ chịu, phù hợp cho những buổi tối thư giãn.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "15",
    title: "Nước hoa hương hổ phách nồng ấm",
    images: [product_15],
    price: { "50ml": 44, "100ml": 64, "200ml": 89 },
    description:
      "Nước hoa hương hổ phách nồng ấm kết hợp hổ phách đậm đà và các nốt hương gia vị cuốn hút. Hương thơm mạnh mẽ giúp bạn thể hiện dấu ấn riêng.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "16",
    title: "Nước hoa hương bạc hà tươi mát",
    images: [product_16],
    price: { "50ml": 36, "100ml": 56, "200ml": 81 },
    description:
      "Nước hoa hương bạc hà tươi mát kết hợp bạc hà và trà xanh. Hương thơm sảng khoái mang đến khởi đầu buổi sáng đầy năng lượng.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "17",
    title: "Nước hoa hương trầm quyến rũ",
    images: [product_17],
    price: { "50ml": 48, "100ml": 70, "200ml": 95 },
    description:
      "Nước hoa hương trầm quyến rũ mang nốt hương trầm hương và nhang thơm đậm đà. Hương thơm sang trọng giúp bạn để lại ấn tượng khó quên.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "18",
    title: "Nước hoa hương quả mọng",
    images: [product_18],
    price: { "50ml": 39, "100ml": 59, "200ml": 84 },
    description:
      "Nước hoa hương quả mọng kết hợp nét ngọt dịu của trái cây và thoang thoảng hương hoa. Hương thơm tươi vui, phù hợp cho những hoạt động ban ngày.",
    category: "Body Care",
    type: "Perfume",
    sizes: ["50ml", "100ml", "200ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "19",
    title: "Tinh chất cấp ẩm axit hyaluronic",
    images: [product_19],
    price: { "30ml": 25, "50ml": 40, "100ml": 60 },
    description:
      "Tinh chất axit hyaluronic cấp ẩm sâu và giữ ẩm, giúp da căng mọng. Kết cấu nhẹ phù hợp với mọi loại da.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "20",
    title: "Tinh chất làm sáng da vitamin C",
    images: [product_20],
    price: { "30ml": 28, "50ml": 45, "100ml": 65 },
    description:
      "Tinh chất vitamin C giúp làm sáng da và giảm đốm thâm. Khả năng chống oxy hóa giúp cải thiện làn da xỉn màu.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "21",
    title: "Tinh chất retinol chống lão hóa",
    images: [product_21],
    price: { "30ml": 30, "50ml": 50, "100ml": 70 },
    description:
      "Tinh chất retinol chống lão hóa giúp làm mờ nếp nhăn, mang lại làn da trẻ trung hơn. Công thức hỗ trợ quá trình sản sinh collagen trong đêm.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "22",
    title: "Tinh chất niacinamide cân bằng da",
    images: [product_22],
    price: { "30ml": 22, "50ml": 35, "100ml": 55 },
    description:
      "Tinh chất niacinamide giúp kiểm soát dầu, cải thiện lỗ chân lông và bề mặt da. Sản phẩm đồng thời hỗ trợ làm dịu tình trạng viêm, mẩn đỏ.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "23",
    title: "Tinh chất peptide làm săn chắc da",
    images: [product_23],
    price: { "30ml": 32, "50ml": 52, "100ml": 75 },
    description:
      "Tinh chất peptide hỗ trợ sản sinh collagen, giúp da săn chắc hơn. Công thức chuyên biệt giúp phục hồi độ đàn hồi của da.",
    category: "Face Care",
    type: "Serum",
    sizes: ["30ml", "50ml", "100ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "24",
    title: "Dầu gội tạo độ phồng",
    images: [product_24],
    price: { "200ml": 15, "400ml": 25, "750ml": 40 },
    description:
      "Dầu gội tạo độ phồng giúp mái tóc mảnh trông bồng bềnh hơn. Công thức làm sạch dịu nhẹ, đồng thời tạo độ phồng từ chân tóc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "25",
    title: "Dầu gội dưỡng ẩm",
    images: [product_25],
    price: { "200ml": 18, "400ml": 30, "750ml": 45 },
    description:
      "Dầu gội dưỡng ẩm bổ sung dầu tự nhiên, giúp cấp ẩm cho tóc khô. Công thức giàu dưỡng chất giúp phục hồi độ ẩm cho mái tóc thiếu sức sống.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "26",
    title: "Dầu gội làm sạch sâu",
    images: [product_26],
    price: { "200ml": 20, "400ml": 35, "750ml": 50 },
    description:
      "Dầu gội làm sạch sâu giúp loại bỏ cặn tích tụ, mang lại mái tóc sạch thoáng. Sử dụng hằng tuần để chăm sóc da đầu và làm mới mái tóc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "27",
    title: "Dầu gội giảm gàu",
    images: [product_27],
    price: { "200ml": 16, "400ml": 28, "750ml": 42 },
    description:
      "Dầu gội giảm gàu giúp làm dịu da đầu. Công thức chuyên biệt hỗ trợ kiểm soát tình trạng ngứa và bong tróc.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "28",
    title: "Dầu gội bảo vệ màu nhuộm",
    images: [product_28],
    price: { "200ml": 19, "400ml": 32, "750ml": 48 },
    description:
      "Dầu gội bảo vệ màu nhuộm giúp giữ màu tóc rực rỡ. Công thức không chứa sulfat giúp màu nhuộm bền lâu hơn.",
    category: "Hair Care",
    type: "Shampoo",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "29",
    title: "Xịt thơm toàn thân hương cam chanh",
    images: [product_29],
    price: { "150ml": 12, "250ml": 20, "500ml": 35 },
    description:
      "Xịt thơm toàn thân hương cam chanh mang đến cảm giác tươi mát tức thì. Làn sương nhẹ với hương thơm sảng khoái giúp bạn lấy lại năng lượng trong ngày.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "30",
    title: "Xịt thơm toàn thân hương bạc hà",
    images: [product_30],
    price: { "150ml": 14, "250ml": 22, "500ml": 38 },
    description:
      "Xịt thơm toàn thân hương bạc hà mang lại cảm giác mát dịu, đầy sức sống. Công thức tươi mát đánh thức các giác quan và làm dịu làn da.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "31",
    title: "Xịt thơm toàn thân hương vani",
    images: [product_31],
    price: { "150ml": 13, "250ml": 21, "500ml": 36 },
    description:
      "Xịt thơm toàn thân hương vani mang đến nét ngọt ngào, ấm áp cho ngày mới. Hương vani dịu nhẹ bao bọc cơ thể, tạo cảm giác thư thái.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "32",
    title: "Xịt thơm toàn thân hương sóng biển",
    images: [product_32],
    price: { "150ml": 15, "250ml": 25, "500ml": 40 },
    description:
      "Xịt thơm toàn thân hương sóng biển mang nốt hương nước mát trong trẻo. Mỗi lần xịt gợi cảm giác thư thái như đang tận hưởng kỳ nghỉ bên bờ biển.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "33",
    title: "Xịt thơm toàn thân hương quả mọng",
    images: [product_33],
    price: { "150ml": 11, "250ml": 18, "500ml": 32 },
    description:
      "Xịt thơm toàn thân hương quả mọng mang hương trái cây ngọt ngào, tươi vui. Sự kết hợp của nhiều loại quả mọng tạo nên trải nghiệm hương thơm thú vị.",
    category: "Body Care",
    type: "Body-Spray",
    sizes: ["150ml", "250ml", "500ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "34",
    title: "Sữa rửa mặt tạo bọt dịu nhẹ",
    images: [product_34],
    price: { "100ml": 15, "200ml": 25, "400ml": 40 },
    description:
      "Sữa rửa mặt tạo bọt dịu nhẹ phù hợp với da nhạy cảm. Công thức cân bằng độ pH giúp loại bỏ bụi bẩn mà vẫn giữ lớp dầu tự nhiên trên da.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "35",
    title: "Sữa rửa mặt kiểm soát dầu",
    images: [product_35],
    price: { "100ml": 18, "200ml": 30, "400ml": 45 },
    description:
      "Sữa rửa mặt kiểm soát dầu giúp giảm bã nhờn dư thừa. Công thức làm sạch sâu hỗ trợ hạn chế bóng dầu suốt ngày dài.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "36",
    title: "Sữa rửa mặt dưỡng ẩm",
    images: [product_36],
    price: { "100ml": 20, "200ml": 35, "400ml": 50 },
    description:
      "Sữa rửa mặt dưỡng ẩm có kết cấu dạng sữa, giúp làm sạch đồng thời nuôi dưỡng da. Công thức dịu nhẹ phù hợp với da khô hoặc thiếu nước.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "37",
    title: "Gel rửa mặt tẩy tế bào chết",
    images: [product_37],
    price: { "100ml": 22, "200ml": 38, "400ml": 55 },
    description:
      "Gel rửa mặt tẩy tế bào chết nhẹ nhàng loại bỏ lớp tế bào già cỗi. Công thức dùng hằng ngày giúp da sáng, mịn hơn mà không gây kích ứng.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "38",
    title: "Nước tẩy trang micellar",
    images: [product_38],
    price: { "100ml": 16, "200ml": 28, "400ml": 42 },
    description:
      "Nước tẩy trang micellar giúp loại bỏ lớp trang điểm dễ dàng mà không cần rửa lại. Sản phẩm kết hợp làm sạch, cân bằng và làm tươi mát da trong một bước.",
    category: "Face Care",
    type: "Cleanser",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "39",
    title: "Nước rửa tay kháng khuẩn",
    images: [product_39],
    price: { "250ml": 10, "500ml": 18, "1000ml": 30 },
    description:
      "Nước rửa tay kháng khuẩn giúp làm sạch và bảo vệ đôi tay một cách dịu nhẹ. Công thức loại bỏ 99,9% vi khuẩn mà không làm khô da tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "40",
    title: "Nước rửa tay dưỡng ẩm",
    images: [product_40],
    price: { "250ml": 12, "500ml": 20, "1000ml": 35 },
    description:
      "Nước rửa tay dưỡng ẩm bổ sung nha đam giúp chăm sóc đôi tay. Công thức làm sạch đồng thời duy trì hàng rào giữ ẩm tự nhiên của da.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "41",
    title: "Nước rửa tay hương cam chanh",
    images: [product_41],
    price: { "250ml": 11, "500ml": 19, "1000ml": 32 },
    description:
      "Nước rửa tay hương cam chanh mang đến cảm giác tươi mát, sảng khoái. Đôi tay được làm sạch và lưu lại hương cam chanh dễ chịu.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "42",
    title: "Nước rửa tay hương oải hương",
    images: [product_42],
    price: { "250ml": 13, "500ml": 22, "1000ml": 38 },
    description:
      "Nước rửa tay hương oải hương có công thức dịu nhẹ, giúp làm dịu da. Tinh dầu oải hương mang đến cảm giác thư giãn mỗi khi rửa tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "43",
    title: "Nước rửa tay tràm trà",
    images: [product_43],
    price: { "250ml": 14, "500ml": 24, "1000ml": 40 },
    description:
      "Nước rửa tay tràm trà giúp làm sạch hiệu quả với thành phần tự nhiên. Đặc tính kháng khuẩn của dầu tràm trà hỗ trợ làm sạch đôi tay.",
    category: "Body Care",
    type: "Hand-Wash",
    sizes: ["250ml", "500ml", "1000ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "44",
    title: "Son lì màu đỏ",
    images: [product_44],
    price: { "3g": 15, "5g": 25 },
    description:
      "Son lì màu đỏ mang đến đôi môi nổi bật với sắc son bền màu, mịn như nhung. Công thức giàu sắc tố cho độ che phủ cao mà vẫn dễ chịu khi sử dụng.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["3g", "5g"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "45",
    title: "Son dưỡng ẩm",
    images: [product_45],
    price: { "4g": 10, "8g": 18 },
    description:
      "Son dưỡng ẩm bổ sung bơ hạt mỡ giúp đôi môi mềm mại. Công thức giàu dưỡng chất làm dịu tức thì tình trạng môi khô, nứt nẻ.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["4g", "8g"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "46",
    title: "Son bóng màu hồng",
    images: [product_46],
    price: { "5ml": 12, "10ml": 20 },
    description:
      "Son bóng màu hồng giúp đôi môi căng mọng, rạng rỡ mà không gây bết dính. Lớp son bóng nổi bật kết hợp sắc hồng nhẹ nhàng, tự nhiên.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["5ml", "10ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "47",
    title: "Tinh chất dưỡng môi vitamin E",
    images: [product_47],
    price: { "10ml": 18, "20ml": 30 },
    description:
      "Tinh chất dưỡng môi vitamin E giúp phục hồi và nuôi dưỡng đôi môi mịn màng. Công thức chăm sóc chuyên sâu hỗ trợ lấy lại độ mềm mại, đàn hồi cho môi.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["10ml", "20ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "48",
    title: "Son lì màu da",
    images: [product_48],
    price: { "3g": 14, "5g": 24 },
    description:
      "Son lì màu da mang đến vẻ đẹp tự nhiên, phù hợp sử dụng hằng ngày. Sắc son dễ phối, hài hòa với mọi tông da và có lớp màu lì thanh lịch.",
    category: "Face Care",
    type: "Lip-Product",
    sizes: ["3g", "5g"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "49",
    title: "Sữa dưỡng thể nha đam",
    images: [product_49],
    price: { "200ml": 15, "400ml": 25, "750ml": 40 },
    description:
      "Sữa dưỡng thể nha đam giúp làm dịu, làm mát và cấp ẩm cho da. Kết cấu nhẹ thẩm thấu nhanh, làm dịu tức thì làn da khô.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: true,
    inStock: true,
  },
  {
    _id: "50",
    title: "Kem dưỡng tay bơ hạt mỡ",
    images: [product_50],
    price: { "100ml": 12, "200ml": 20, "400ml": 35 },
    description:
      "Kem dưỡng tay bơ hạt mỡ có kết cấu giàu dưỡng chất, giúp nuôi dưỡng da tay. Công thức chuyên sâu duy trì độ ẩm lâu dài cho đôi tay thường xuyên hoạt động.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "51",
    title: "Sữa dưỡng thể dừa cấp ẩm",
    images: [product_51],
    price: { "200ml": 18, "400ml": 30, "750ml": 45 },
    description:
      "Sữa dưỡng thể dừa cấp ẩm sâu cho da với kết cấu nhẹ và hương thơm nhiệt đới.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "52",
    title: "Sữa dưỡng thể oải hương thư giãn",
    images: [product_52],
    price: { "100ml": 14, "200ml": 22, "400ml": 38 },
    description:
      "Sữa dưỡng thể oải hương có hương thơm dịu nhẹ, giúp làm dịu da và mang lại cảm giác thư giãn.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "53",
    title: "Sữa dưỡng thể bổ sung vitamin E",
    images: [product_53],
    price: { "200ml": 20, "400ml": 35, "750ml": 50 },
    description:
      "Sữa dưỡng thể bổ sung vitamin E giàu chất chống oxy hóa, giúp bảo vệ và phục hồi da.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["200ml", "400ml", "750ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
  {
    _id: "54",
    title: "Sữa dưỡng thể không mùi cho da nhạy cảm",
    images: [product_54],
    price: { "100ml": 16, "200ml": 28, "400ml": 42 },
    description:
      "Sữa dưỡng thể không mùi mang đến sự chăm sóc dịu nhẹ cho làn da nhạy cảm.",
    category: "Body Care",
    type: "Lotion",
    sizes: ["100ml", "200ml", "400ml"],
    date: 1716634345448,
    popular: false,
    inStock: true,
  },
];


// Blogs Dummy Data 
export const blogs = [
  {
    title: "10 sản phẩm chăm sóc da nên có trong năm 2026",
    category: "Bí quyết chăm sóc da",
    image: blog1,
    description:
      "Khám phá các sản phẩm thiết yếu trong quy trình chăm sóc da để có làn da khỏe mạnh, rạng rỡ trong năm 2026.",
  },
  {
    title: "Cách chọn màu kem nền phù hợp",
    category: "Hướng dẫn trang điểm",
    image: blog2,
    description:
      "Hướng dẫn từng bước chọn màu kem nền phù hợp với làn da, giúp lớp trang điểm mịn đẹp và tự nhiên.",
  },
  {
    title: "Xu hướng chăm sóc tóc phái đẹp nên thử",
    category: "Hair Care",
    image: blog3,
    description:
      "Khám phá những bí quyết và xu hướng sản phẩm chăm sóc tóc mới nhất để mái tóc chắc khỏe, dễ tạo kiểu và óng mượt.",
  },
  {
    title: "Cách chuẩn bị bộ trang điểm cho người mới bắt đầu",
    category: "Kiến thức làm đẹp cơ bản",
    image: blog4,
    description:
      "Danh sách đầy đủ các món trang điểm thiết yếu cho người mới bắt đầu, phù hợp với nhu cầu hằng ngày và những dịp đặc biệt.",
  },
  {
    title: "Tối ưu hiệu quả chăm sóc da ban đêm",
    category: "Quy trình chăm sóc da",
    image: blog5,
    description:
      "Tìm hiểu cách xây dựng quy trình chăm sóc da ban đêm phù hợp để tăng cường độ ẩm và hỗ trợ chống lão hóa.",
  },
  {
    title: "Lợi ích của mỹ phẩm hữu cơ và tự nhiên",
    category: "Phong cách sống",
    image: blog6,
    description:
      "Tìm hiểu lý do ngày càng nhiều người chọn mỹ phẩm tự nhiên và những lợi ích lâu dài đối với làn da.",
  },
  {
    title: "Bí quyết giữ màu son suốt ngày dài",
    category: "Bí quyết trang điểm",
    image: blog7,
    description:
      "Những mẹo đơn giản mà hiệu quả giúp màu son luôn tươi tắn, rạng rỡ từ sáng đến tối.",
  },
  {
    title: "Dự báo xu hướng trang điểm và chăm sóc da năm 2026",
    category: "Xu hướng làm đẹp",
    image: blog8,
    description:
      "Góc nhìn chuyên gia về những xu hướng trang điểm và chăm sóc da nổi bật, định hình phong cách làm đẹp năm 2026.",
  },
];


export const dummyAddress = [
  {
    _id: "67b5b9e54ea97f71bbc196a0",
    userId: "68591d36daf423db94fa8f4f",
    firstName: "user",
    lastName: "one",
    email: "userone@gmail.com",
    street: "789 Elm Street",
    city: "Springfield",
    state: "California",
    zipcode: 90210,
    country: "US",
    phone: "+1-555-123-4567",
  },
  {
     _id: "67b5b9e54ea97fdfgdbcsd5",
    userId: "68591d36daf423db94fa8f4f",
    firstName: "Jane",
    lastName: "Smith",
    email: "janesmith@gmail.com",
    street: "456 Elm Street",
    city: "Metropolis",
    state: "CA",
    zipcode: "998877",
    country: "United States",
    phone: "9876543210",
  },

];


export const dummyOrdersData = [
  {
    _id: "685a5bbfaff57babcdfcc171",
    userId: "68591d36daf423db94fa8f4f",
    items: [
      {
        product: dummyProducts[0], // Argan Hair Oil
        quantity: 1,
        size: "50ml",
        _id: "685a5bbfaff57babcdfcc172",
      },
      {
        product: dummyProducts[3], // Tea Tree Hair Oil
        quantity: 2,
        size: "100ml",
        _id: "685a5bbfaff57babcdfcc173",
      },
    ],
    amount: 40.6,
    address: dummyAddress[0],
    status: "Out for delivery",
    paymentMethod: "COD",
    isPaid: false,
    createdAt: "2026-06-24T08:03:11.197+00:00",
    updatedAt: "2026-06-24T11:02:04.631+00:00",
    __v: 0,
  },
  {
    _id: "685a5bbfaff57babcdfcc174",
    userId: "68591d36daf423db94fa8f4f",
    items: [
      {
        product: dummyProducts[8], // Vitamin C Face Oil
        quantity: 1,
        size: "30ml",
        _id: "685a5bbfaff57babcdfcc175",
      },
      {
        product: dummyProducts[24], // Volumizing Shampoo
        quantity: 3,
        size: "400ml",
        _id: "685a5bbfaff57babcdfcc176",
      },
    ],
    amount: 85.0,
    address: dummyAddress[0],
    status: "Delivered",
    paymentMethod: "Online",
    isPaid: true,
    createdAt: "2026-07-01T09:15:45.197+00:00",
    updatedAt: "2026-07-01T11:30:04.631+00:00",
    __v: 0,
  },
];


// Dashboard Dummy Data
export const dummyDashboardData = {
    "totalOrders": 2,
    "totalRevenue": 897,
    "orders": dummyOrdersData
}
