import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import background from "../assets/bg.webp";

const Hero = () => {
  return (
    <section className="max-padd-container">
      <div className="h-[89vh] w-full mt-18 rounded-2xl relative overflow-hidden">
        <img src={background} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative mx-auto max-w-[1440px] px-4 pt-1 sm:pt-8 flex flex-col justify-between h-full">
          <div className="max-w-3xl">
            <h1 className="h1 !font-[400] capitalize">
              Enhance Your
              <span className="!font-[600] text-secondary"> Look</span> With
              <span className="!font-[600] text-secondary"> Glam </span>{" "}
              Essentials
            </h1>
            <p>
              Discover premium beauty with our cosmetic collection, crafted to
              enhance your natural glow, boost confidence, and deliver flawless
              elegance every day with trusted, affordable products.
            </p>
            <div className="flex">
              <Link
                to={"/collection"}
                className="bg-secondary text-white text-xs font-medium capitalize pl-5 rounded-full flexCenter gap-x-2 mt-7 group"
              >
                Check Our Modern Collection
                <img
                  src={assets.forward}
                  alt=""
                  width={41}
                  className="bg-white rounded-full flexCenter p-2 m-1 group-hover:translate-x-3 transition-all duration-500 shadow-lg"
                />
              </Link>
            </div>
          </div>
          {/* Card */}
          <div className="bg-white p-3 max-w-[249px] rounded-2xl mb-4">
            <div className="h-32 w-56 overflow-hidden">
              <img
                src={assets.hero}
                alt=""
                className="h-30 object-cover w-full rounded-2xl"
              />
            </div>
            <p className="text-[13px] pt-2">
              <b className="uppercase">Unlock</b> your best look, one click at a
              time, Your style upgrade starts here, shop today!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
