import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatVnd } from "../../utils/money";
import { memo } from "react";

const RevenueChart = ({ data, currency }) => (
  <ResponsiveContainer width="100%" height={280} minWidth={0}>
    <BarChart data={data}>
      <CartesianGrid vertical={false} stroke="#eeeeee" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7d8792", fontSize: 12 }} />
      <YAxis axisLine={false} tickLine={false} width={68} tick={{ fill: "#777777", fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
      <Tooltip formatter={(value) => formatVnd(value, currency)} cursor={{ fill: "#f4f6f5" }} />
      <Legend />
      <Bar dataKey="total" name="Giá trị đơn hàng" fill="#cccccc" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      <Bar dataKey="successful" name="Đã thanh toán" fill="#202020" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>
);

export default memo(RevenueChart);
