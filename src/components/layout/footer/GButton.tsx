import React, { useState } from 'react';
import { useTranslations } from '@deriv-com/translations';
import { Tooltip } from '@deriv-com/ui';

type TGButton = {
    onAdminFormOpen: () => void;
};

const GButton = ({ onAdminFormOpen }: TGButton) => {
    const { localize } = useTranslations();
    const [clickCount, setClickCount] = useState(0);

    const handleGButtonClick = () => {
        setClickCount(prev => {
            const next = prev + 1;
            if (next >= 4) {
                onAdminFormOpen();
                return 0;
            }
            return next;
        });
    };

    return (
        <Tooltip
            as='button'
            className='app-footer__icon app-footer__g-button'
            onClick={handleGButtonClick}
            tooltipContent={localize('Admin access')}
        >
            <span className='app-footer__g-button-dot' aria-hidden='true' />
        </Tooltip>
    );
};

export default GButton;
