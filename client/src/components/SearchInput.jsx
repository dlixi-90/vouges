import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/data";

const SearchInput = () => {
  const { searchQuery, setSearchQuery } = useAppContext();
  return (
    <div className="net-search-input py-4">
      <div className="text-center">
        <div className="net-field-shell inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-white ring-1 ring-slate-900/20 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm sản phẩm…"
            className="border-none outline-none w-full text-sm"
          />
          <div>
            <img src={assets.search} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
