import { forwardRef } from "react";
import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface RevealProps {
  as?: ElementType;
  children: ReactNode;
  delay?: number;
  className?: string;
}

const Reveal = forwardRef<HTMLDivElement, RevealProps>(function Reveal(
  { as = "div", children, delay = 0, className },
  ref
) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as as "div"] as typeof motion.div;

  if (reduceMotion) {
    const Plain = as as ElementType;
    return (
      <Plain ref={ref} className={className}>
        {children}
      </Plain>
    );
  }

  return (
    <Component
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
});

export default Reveal;
