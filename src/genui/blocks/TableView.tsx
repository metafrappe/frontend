import { Table as TableIcon } from '@phosphor-icons/react';
import { Table } from 'antd';
import { useMessage } from '@/app/locale';

import type { TableBlock, TableCell } from '../types';

export function TableView({ block }: { block: TableBlock }) {
  const m = useMessage();
  // Satır anahtarı sütunu her zaman kimliktir. Diğerleri açıklamadır, sarılır.
  const columns = block.columns.map((column) => {
    const kind = column.key === block.rowKey ? 'id' : (column.kind ?? 'text');
    return {
      key: column.key,
      dataIndex: column.key,
      title: column.title,
      className: kind === 'id' ? 'genui-cell-id' : 'genui-cell-text',
      // Tablo hücresi en büyük genişliği dinlemez. Sınır içteki kutudadır.
      ...(kind === 'text'
        ? { render: (value: TableCell) => <span className="genui-wrap">{value}</span> }
        : {}),
    };
  });
  return (
    <section data-genui="table" className="genui-card">
      <header className="genui-card-h">
        <TableIcon aria-hidden />
        <strong>{block.title}</strong>
        <span className="genui-muted">
          {m('genui.table.rowCount', { count: block.rows.length })}
        </span>
      </header>
      {/* Tablo kendi kapsayıcısında yatay kayar. Sayfa taşmaz. */}
      <div className="genui-table-scroll">
        <Table<Record<string, TableCell>>
          size="small"
          pagination={false}
          rowKey={(row) => String(row[block.rowKey])}
          columns={columns}
          dataSource={block.rows}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </section>
  );
}
