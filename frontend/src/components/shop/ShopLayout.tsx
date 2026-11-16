import { Outlet } from "react-router-dom";
import CartDrawer from "./CartDrawer";

// Every /shop route renders inside this layout. The shop's own navigation
// (Shop, Stores, Sell and the cart button) lives in the main Navbar, which
// switches its links on /shop routes; this layout adds the slide-out cart.
export default function ShopLayout() {
  return (
    <>
      <Outlet />
      <CartDrawer />
    </>
  );
}
