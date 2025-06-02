import type { FC, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CheckeredBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: number; 
  color1?: string;
  color2?: string; 
}

const CheckeredBackground: FC<CheckeredBackgroundProps> = ({
  children,
  className,
  size = 8,
  color1 = 'hsl(var(--card))', 
  color2 = 'hsl(var(--muted))',
  ...props
}) => {
  // Ensure colors are dynamic based on theme. Need to access CSS vars in JS.
  // This is a simplified approach. For full dynamic theme, consider CSS-in-JS or inline style with getComputedStyle.
  // For now, using HSL values directly corresponding to theme for simplicity.
  // color1 default is card background, color2 is muted background.

  const backgroundImagePattern = `
    linear-gradient(45deg, ${color2} 25%, transparent 25%), 
    linear-gradient(-45deg, ${color2} 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, ${color2} 75%), 
    linear-gradient(-45deg, transparent 75%, ${color2} 75%)
  `;
  
  const backgroundSizePattern = `${size * 2}px ${size * 2}px`;
  const backgroundPositionPattern = `0 0, 0 ${size}px, ${size}px -${size}px, -${size}px 0px`;

  return (
    <div
      className={cn('relative overflow-hidden rounded-md', className)}
      style={{
        backgroundColor: color1,
        backgroundImage: backgroundImagePattern,
        backgroundSize: backgroundSizePattern,
        backgroundPosition: backgroundPositionPattern,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default CheckeredBackground;
