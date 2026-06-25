import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`} {...props}>
        {children}
    </div>
));

Card.displayName = 'Card';

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
    ({ className = '', children, ...props }, ref) => (
        <div ref={ref} className={`p-6 pt-0 ${className}`} {...props}>
            {children}
        </div>
    )
);

CardContent.displayName = 'CardContent';
