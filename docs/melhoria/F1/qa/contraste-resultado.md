# Contraste dos tokens — 63 pares, 10 abaixo do mínimo

| Frente | Cor | Fundo | Fundo (hex) | Tipo | Razão | Mínimo | Resultado | Sugestão (mesmo matiz) | Onde |
|---|---|---|---|---|---|---|---|---|---|
| dark.onAction | `#FFFFFF` | dark.action | `#FF6A13` | texto | 2.87:1 | 4.5:1 | **FALHA** | `#303030` | Button primary md (bodyBold 16 px) — button.tsx:31 |
| dark.onAction | `#FFFFFF` | dark.action | `#FF6A13` | grande | 2.87:1 | 3:1 | **FALHA** | `#4A4A4A` | Button primary lg (variant title, 20 px negrito = texto grande) — button.tsx:71 |
| #FFFFFF | `#FFFFFF` | dark.danger | `#FF4D45` | texto | 3.28:1 | 4.5:1 | **FALHA** | `#262626` | Button danger — button.tsx:34 |
| dark.line | `#24252B` | dark.background | `#070708` | ui | 1.32:1 | 3:1 | **FALHA** | `#5B5C60` | borda do Button secondary / Surface — button.tsx:60 |
| dark.line | `#24252B` | dark.surface | `#111215` | ui | 1.23:1 | 3:1 | **FALHA** | `#616266` | borda de campo sobre superfície |
| factions.striders.color | `#0072B2` | dark.background | `#070708` | texto | 3.88:1 | 4.5:1 | **FALHA** | `#177FB9` | cor do time como texto |
| factions.volt.onColor | `#FFFFFF` | factions.volt.color | `#009E73` | texto | 3.42:1 | 4.5:1 | **FALHA** | `#242424` | texto sobre o selo do time |
| factions.owls.color | `#D7263D` | dark.background | `#070708` | texto | 4.06:1 | 4.5:1 | **FALHA** | `#DB3A4E` | cor do time como texto |
| light.onAction | `#FFFFFF` | light.action | `#FF5A1F` | texto | 3.12:1 | 4.5:1 | **FALHA** | `#2B2B2B` | (tema claro, sem uso) botão primário |
| palette.ink3 | `#A5A5AE` | palette.white | `#FFFFFF` | texto | 2.44:1 | 4.5:1 | **FALHA** | `#75757C` | (tema claro, sem uso) ink3 |
| dark.text | `#F3F1ED` | dark.background | `#070708` | texto | 17.85:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | dark.background | `#070708` | texto | 8.28:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | dark.background | `#070708` | texto | 7.74:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | dark.background | `#070708` | texto | 6.14:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | dark.surface | `#111215` | texto | 16.60:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | dark.surface | `#111215` | texto | 7.70:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | dark.surface | `#111215` | texto | 7.20:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | dark.surface | `#111215` | texto | 5.71:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | dark.surfaceSunken | `#1A1B20` | texto | 15.24:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | dark.surfaceSunken | `#1A1B20` | texto | 7.07:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | dark.surfaceSunken | `#1A1B20` | texto | 6.61:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | dark.surfaceSunken | `#1A1B20` | texto | 5.24:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | neon.bgDeep | `#050506` | texto | 18.06:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | neon.bgDeep | `#050506` | texto | 8.38:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | neon.bgDeep | `#050506` | texto | 7.83:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | neon.bgDeep | `#050506` | texto | 6.21:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | neon.glowBg | `#2B1407` | texto | 15.44:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | neon.glowBg | `#2B1407` | texto | 7.16:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | neon.glowBg | `#2B1407` | texto | 6.69:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | neon.glowBg | `#2B1407` | texto | 5.31:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | neon.activeFill/bg | `#2A150A` | texto | 15.38:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | neon.activeFill/bg | `#2A150A` | texto | 7.14:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | neon.activeFill/bg | `#2A150A` | texto | 6.67:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | neon.activeFill/bg | `#2A150A` | texto | 5.29:1 | 4.5:1 | passa | — | mensagens de erro |
| dark.text | `#F3F1ED` | neon.activeFill/surface | `#321E15` | texto | 13.97:1 | 4.5:1 | passa | — | Text (padrão) |
| dark.textSecondary | `#A8A6A1` | neon.activeFill/surface | `#321E15` | texto | 6.48:1 | 4.5:1 | passa | — | Text muted |
| dark.accentText | `#FF7A2A` | neon.activeFill/surface | `#321E15` | texto | 6.06:1 | 4.5:1 | passa | — | Text accent / links |
| dark.danger | `#FF4D45` | neon.activeFill/surface | `#321E15` | texto | 4.80:1 | 4.5:1 | passa | — | mensagens de erro |
| neon.bg (proposta) | `#070708` | dark.action | `#FF6A13` | texto | 7.02:1 | 4.5:1 | passa | — | proposta P8: texto escuro no laranja |
| #FFFFFF | `#FFFFFF` | dark.danger | `#FF4D45` | grande | 3.28:1 | 3:1 | passa | — | Button danger lg |
| dark.action | `#FF6A13` | dark.background | `#070708` | ui | 7.02:1 | 3:1 | passa | — | IconButton action / anel de foco |
| factions.striders.color | `#0072B2` | dark.background | `#070708` | ui | 3.88:1 | 3:1 | passa | — | selo / forma do time / região no mapa |
| factions.striders.color | `#0072B2` | dark.surface | `#111215` | ui | 3.61:1 | 3:1 | passa | — | selo do time sobre cartão |
| factions.striders.onColor | `#FFFFFF` | factions.striders.color | `#0072B2` | texto | 5.19:1 | 4.5:1 | passa | — | texto sobre o selo do time |
| neonTeam.striders | `#2FA8FF` | dark.background | `#070708` | texto | 7.83:1 | 4.5:1 | passa | — | brilho/rotulo neon do time |
| neonTeam.striders | `#2FA8FF` | dark.surface | `#111215` | texto | 7.28:1 | 4.5:1 | passa | — | rotulo neon do time sobre cartão |
| factions.volt.color | `#009E73` | dark.background | `#070708` | texto | 5.89:1 | 4.5:1 | passa | — | cor do time como texto |
| factions.volt.color | `#009E73` | dark.background | `#070708` | ui | 5.89:1 | 3:1 | passa | — | selo / forma do time / região no mapa |
| factions.volt.color | `#009E73` | dark.surface | `#111215` | ui | 5.47:1 | 3:1 | passa | — | selo do time sobre cartão |
| neonTeam.volt | `#19E6A8` | dark.background | `#070708` | texto | 12.39:1 | 4.5:1 | passa | — | brilho/rotulo neon do time |
| neonTeam.volt | `#19E6A8` | dark.surface | `#111215` | texto | 11.53:1 | 4.5:1 | passa | — | rotulo neon do time sobre cartão |
| factions.owls.color | `#D7263D` | dark.background | `#070708` | ui | 4.06:1 | 3:1 | passa | — | selo / forma do time / região no mapa |
| factions.owls.color | `#D7263D` | dark.surface | `#111215` | ui | 3.78:1 | 3:1 | passa | — | selo do time sobre cartão |
| factions.owls.onColor | `#FFFFFF` | factions.owls.color | `#D7263D` | texto | 4.96:1 | 4.5:1 | passa | — | texto sobre o selo do time |
| neonTeam.owls | `#FF2D55` | dark.background | `#070708` | texto | 5.52:1 | 4.5:1 | passa | — | brilho/rotulo neon do time |
| neonTeam.owls | `#FF2D55` | dark.surface | `#111215` | texto | 5.14:1 | 4.5:1 | passa | — | rotulo neon do time sobre cartão |
| factions.coyotes.color | `#D9B200` | dark.background | `#070708` | texto | 9.89:1 | 4.5:1 | passa | — | cor do time como texto |
| factions.coyotes.color | `#D9B200` | dark.background | `#070708` | ui | 9.89:1 | 3:1 | passa | — | selo / forma do time / região no mapa |
| factions.coyotes.color | `#D9B200` | dark.surface | `#111215` | ui | 9.20:1 | 3:1 | passa | — | selo do time sobre cartão |
| factions.coyotes.onColor | `#242428` | factions.coyotes.color | `#D9B200` | texto | 7.60:1 | 4.5:1 | passa | — | texto sobre o selo do time |
| neonTeam.coyotes | `#FFD60A` | dark.background | `#070708` | texto | 14.26:1 | 4.5:1 | passa | — | brilho/rotulo neon do time |
| neonTeam.coyotes | `#FFD60A` | dark.surface | `#111215` | texto | 13.27:1 | 4.5:1 | passa | — | rotulo neon do time sobre cartão |
| light.textSecondary | `#5E5E66` | light.background | `#F7F6F3` | texto | 5.94:1 | 4.5:1 | passa | — | (tema claro, sem uso) |
