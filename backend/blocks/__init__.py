from .read_csv import ReadCSVBlock
from .filter_block import FilterBlock
from .enrich_lead import EnrichLeadBlock
from .find_email import FindEmailBlock
from .save_csv import SaveCSVBlock

BLOCK_REGISTRY = {
    "read_csv": ReadCSVBlock,
    "filter": FilterBlock,
    "enrich_lead": EnrichLeadBlock,
    "find_email": FindEmailBlock,
    "save_csv": SaveCSVBlock,
}
