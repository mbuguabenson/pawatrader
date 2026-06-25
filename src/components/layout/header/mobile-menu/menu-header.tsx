import { ComponentProps, useMemo } from 'react';
import { LANGUAGES } from '@/utils/languages';
import { useTranslations } from '@deriv-com/translations';
import { Text, useDevice } from '@deriv-com/ui';

type TMenuHeader = {
    hideLanguageSetting: boolean;
    openLanguageSetting: ComponentProps<'button'>['onClick'];
};

const MenuHeader = ({ hideLanguageSetting, openLanguageSetting }: TMenuHeader) => {
    const { currentLang, localize } = useTranslations();
    const { isDesktop } = useDevice();

    const countryIcon = useMemo(
        () => LANGUAGES.find(({ code }) => code === currentLang)?.placeholderIconInMobile,
        [currentLang]
    );

    return (
        <div className='mobile-menu__header'>
            <Text size={isDesktop ? 'md' : 'lg'} weight='bold'>
                {localize('Menu')}
            </Text>
        </div>
    );
};

export default MenuHeader;
