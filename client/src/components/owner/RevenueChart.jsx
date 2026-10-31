import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatVnd } from "../../utils/money";
import { memo } from "react";

const RevenueChart = ({ data, currency }) => {
  const isYear = data.length > 6;
  const monthLabel = key => `T${Number(String(key).split("-")[1])}`;
  const tooltipLabel = key => {
    const [year, month] = String(key).split("-");
    return `Tháng ${Number(month)}/${year}`;
  };
  return (
    <div className="revenue-chart-scroll" tabIndex={isYear ? 0 : undefined} role="region" aria-label="Biểu đồ doanh thu theo tháng">
      <div className="revenue-chart-canvas" style={{ minWidth: isYear ? 480 : undefined }}>
        <ResponsiveContainer width="100%" height={272} minWidth={0}>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#eeeeee" />
            <XAxis dataKey="key" interval={0} tickFormatter={monthLabel} axisLine={false} tickLine={false} tickMargin={8} tick={{ fill: "#7d8792", fontSize: isYear ? 11 : 12 }} />
            <YAxis axisLine={false} tickLine={false} width={68} tick={{ fill: "#777777", fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
            <Tooltip labelFormatter={tooltipLabel} formatter={(value) => formatVnd(value, currency)} cursor={{ fill: "#f4f6f5" }} />
            <Legend />
            <Bar dataKey="total" name="Giá trị đơn hàng" fill="#cccccc" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="successful" name="Đã thanh toán" fill="#202020" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default memo(RevenueChart);
