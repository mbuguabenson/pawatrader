import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.market_symbol_changer = {
    init() {
        this.jsonInit({
            message0: localize('Symbol changer status %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'STATUS',
                    options: [
                        [localize('disable'), 'DISABLE'],
                        [localize('enable'), 'ENABLE'],
                    ],
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Special2.colour,
            colourSecondary: window.Blockly.Colours.Special2.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special2.colourTertiary,
            tooltip: localize('This block changes the current traded symbol'),
            category: window.Blockly.Categories.Miscellaneous,
        });
    },
    meta() {
        return {
            display_name: localize('Market Symbol Changer'),
            description: localize('Toggle symbol change capability.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.market_symbol_changer = block => {
    const status = block.getFieldValue('STATUS');
    const code = `window.BinaryBotMarketSymbolChanger = '${status}';\n`;
    return code;
};
