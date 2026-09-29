import { lazy } from "react";
import Hero from "../components/Hero";
import Features from "../components/Features";
import DeferredSection from "../components/DeferredSection";
import banner from "../assets/banner.webp";

const NewArrivals = lazy(() => import("../components/NewArrivals"));
const PopularProducts = lazy(() => import("../components/PopularProducts"));
const Testimonials = lazy(() => import("../components/Testimonials"));

const Home = () => {
  return (
    <>
      <Hero />
      <Features />
      <DeferredSection minHeight={540}><NewArrivals /></DeferredSection>
      <DeferredSection minHeight={450}><PopularProducts /></DeferredSection>
      <div className="hidden sm:block max-padd-container relative mt-28 h-[288px]">
        <img src={banner} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <DeferredSection minHeight={440}><Testimonials /></DeferredSection>
    </>
  );
};

export default Home;
